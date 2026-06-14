// @traceit:start
// @traceit:title: Scanner Module
// @traceit:description: Walks project directories, finds @traceit blocks, parses all annotation fields. Core of generate command.
// @traceit:domain: infrastructure
// @traceit:exports: scan, parseBlock, getCommentPrefix, walkDir
// @traceit:depends: src/types.ts, src/config.ts

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TraceitIndex, TraceitBlock, ParsedAnnotation, TraceitConfig } from './types';
import { getConfig } from './config';

const execAsync = promisify(exec);
const START_TAG = '@traceit:start';
const END_TAG = '@traceit:end';
const REQUIRED_FIELDS = ['title', 'description'];
const MAX_FILE_SIZE = 1 * 1024 * 1024;
const PROGRESS_INTERVAL = 100;

const FIELD_PATTERN = /^@traceit:(\w+):\s*(.*)$/;
const COMMENT_PREFIXES: Record<string, RegExp> = {
  '//': /^\s*\/\/\s?/,
  '#': /^\s*#\s?/,
  '--': /^\s*--\s?/,
  '/*': /^\s*\/\*\s?/,
};

export function getCommentPrefix(line: string): string | null {
  for (const prefix of Object.keys(COMMENT_PREFIXES)) {
    if (line.trim().startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

export function stripComment(line: string, prefix: string): string {
  if (prefix === '/*') {
    const match = line.match(/^\s*\/\*\s?(.*?)(?:\*\/)?\s*$/);
    return match ? match[1].trim() : line.trim();
  }
  return line.replace(COMMENT_PREFIXES[prefix] || /^/, '').trim();
}

function parseAnnotationLine(line: string): { key: string; value: string } | null {
  const prefix = getCommentPrefix(line);
  if (!prefix) return null;

  const stripped = stripComment(line, prefix);
  const match = stripped.match(FIELD_PATTERN);

  if (match) {
    return { key: match[1], value: match[2].trim() };
  }
  return null;
}

export function parseBlock(lines: string[], startLine: number): ParsedAnnotation | null {
  const fields: Record<string, string> = {};
  let endLine = startLine;
  let codeStartLine = -1;
  let codeEndLine = -1;
  let foundStart = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const prefix = getCommentPrefix(line);
    const content = prefix ? stripComment(line, prefix) : line.trim();

    if (content.startsWith(START_TAG)) {
      foundStart = true;
      continue;
    }

    if (content.startsWith(END_TAG)) {
      endLine = i + 1;
      break;
    }

    if (foundStart) {
      const parsed = parseAnnotationLine(line);
      if (parsed) {
        if (parsed.key === 'start' || parsed.key === 'end') continue;
        fields[parsed.key] = parsed.value;
      } else {
        if (codeStartLine === -1) {
          codeStartLine = i + 1;
        }
        codeEndLine = i + 1;
      }
    }
  }

  if (!foundStart || codeStartLine === -1) return null;

  return {
    fields,
    startLine: startLine + 1,
    endLine,
    codeStartLine,
    codeEndLine,
  };
}

function blockToTraceitBlock(parsed: ParsedAnnotation): TraceitBlock {
  const exports = parsed.fields.exports
    ? parsed.fields.exports.split(',').map((e: string) => e.trim())
    : null;
  const depends = parsed.fields.depends
    ? parsed.fields.depends.split(',').map((d: string) => d.trim())
    : null;

  return {
    title: parsed.fields.title || '',
    description: parsed.fields.description || '',
    domain: parsed.fields.domain || null,
    exports,
    depends,
    danger: parsed.fields.danger || null,
    codeLines: [parsed.codeStartLine, parsed.codeEndLine],
    blockLines: [parsed.startLine, parsed.endLine],
  };
}

async function walkDirInternal(
  dir: string,
  ignore: string[],
  ext: string[],
  maxFiles: number,
  files: string[],
  depth: number,
  maxDepth: number,
): Promise<void> {
  if (maxFiles > 0 && files.length >= maxFiles) return;
  if (maxDepth > 0 && depth > maxDepth) return;

  try {
    await fs.access(dir);
  } catch {
    return;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (maxFiles > 0 && files.length >= maxFiles) return;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignore.includes(entry.name)) continue;
      await walkDirInternal(fullPath, ignore, ext, maxFiles, files, depth + 1, maxDepth);
    } else if (entry.isFile()) {
      const extName = path.extname(entry.name).slice(1);
      if (ext.includes(extName)) {
        files.push(fullPath);
      }
    }
  }
}

export async function walkDir(
  dir: string,
  ignore: string[],
  ext: string[],
  maxFiles: number = 0,
  maxDepth: number = 0,
): Promise<string[]> {
  const files: string[] = [];
  await walkDirInternal(dir, ignore, ext, maxFiles, files, 0, maxDepth);
  return files;
}

async function filterGitIgnored(files: string[]): Promise<string[]> {
  if (files.length === 0) return files;
  try {
    const quoted = files.map(f => `"${f}"`).join(' ');
    const { stdout } = await execAsync(`git check-ignore ${quoted}`, { cwd: process.cwd() });
    const ignoredSet = new Set(stdout.split('\n').filter(Boolean).map(l => path.resolve(process.cwd(), l.trim())));
    return files.filter(f => !ignoredSet.has(f));
  } catch {
    return files;
  }
}

async function isBinaryFile(filePath: string): Promise<boolean> {
  let fd: fs.FileHandle | null = null;
  try {
    fd = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(512);
    const { bytesRead } = await fd.read(buf, 0, 512, 0);
    return bytesRead > 0 && buf.slice(0, bytesRead).includes(0);
  } catch {
    return false;
  } finally {
    if (fd) await fd.close();
  }
}

function validateConfig(config: TraceitConfig): void {
  const errors: string[] = [];
  if (config.ext.length === 0) {
    errors.push('ext: at least one file extension required');
  }
  if (config.warnUnchangedDays < 1) {
    errors.push('warnUnchangedDays: must be >= 1');
  }
  if (config.maxFiles < 0) {
    errors.push('maxFiles: must be >= 0');
  }
  if (config.maxDepth < 0) {
    errors.push('maxDepth: must be >= 0');
  }
  if (!['lines', 'periodic', 'summary'].includes(config.progress)) {
    errors.push('progress: must be "lines", "periodic", or "summary"');
  }
  if (errors.length > 0) {
    console.error(`Config validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
}

function progressLines(relPath: string, idx: number, total: number, mode: string): void {
  if (mode === 'summary') return;
  if (mode === 'periodic') {
    const i = idx + 1;
    if (i % PROGRESS_INTERVAL !== 0 && i !== total && i !== 1) return;
  }
  process.stderr.write(`Scanning... [${idx + 1}/${total}] ${relPath}\n`);
}

interface FileResult {
  relPath: string;
  blocks: TraceitBlock[];
  skipped: boolean;
  sizeSkipped: boolean;
}

async function processFile(
  filePath: string,
  idx: number,
  total: number,
  config: TraceitConfig,
  domains: Record<string, string[]>,
): Promise<FileResult> {
  const relPath = path.relative(process.cwd(), filePath);

  progressLines(relPath, idx, total, config.progress);

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return { relPath, blocks: [], skipped: false, sizeSkipped: false };
  }

  if (stat.size > MAX_FILE_SIZE) {
    return { relPath, blocks: [], skipped: false, sizeSkipped: true };
  }

  if (await isBinaryFile(filePath)) {
    return { relPath, blocks: [], skipped: false, sizeSkipped: false };
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const blocks: TraceitBlock[] = [];
  let blocksSkippedHere = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(START_TAG)) {
      const parsed = parseBlock(lines, i);
      if (parsed) {
        const missing = REQUIRED_FIELDS.filter(f => !parsed.fields[f]);

        if (missing.length > 0) {
          blocksSkippedHere++;
          continue;
        }

        const block = blockToTraceitBlock(parsed);
        blocks.push(block);

        if (block.domain) {
          if (!domains[block.domain]) {
            domains[block.domain] = [];
          }
          if (!domains[block.domain].includes(relPath)) {
            domains[block.domain].push(relPath);
          }
        }

        i = parsed.endLine - 1;
      }
    }
  }

  return { relPath, blocks, skipped: blocksSkippedHere > 0, sizeSkipped: false };
}

function buildFilesIndex(results: FileResult[]): Record<string, any> {
  const filesIndex: Record<string, any> = {};

  for (const { relPath, blocks } of results) {
    if (blocks.length === 0) continue;

    const parts = relPath.split(path.sep);
    let current = filesIndex;

    for (let j = 0; j < parts.length - 1; j++) {
      const part = parts[j];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = blocks;
  }

  return filesIndex;
}

async function concurrentMap<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let index = 0;
  const runNext = async (): Promise<void> => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i], i);
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
  await Promise.all(workers);
}

export async function scan(config?: TraceitConfig): Promise<TraceitIndex> {
  const cfg = config || getConfig();
  validateConfig(cfg);

  let files = await walkDir(process.cwd(), cfg.ignore, cfg.ext, cfg.maxFiles, cfg.maxDepth);
  files = await filterGitIgnored(files);

  if (cfg.maxFiles > 0 && files.length > cfg.maxFiles) {
    files = files.slice(0, cfg.maxFiles);
  }

  const total = files.length;
  const concurrency = os.cpus().length;
  const domains: Record<string, string[]> = {};
  const results: FileResult[] = new Array(total);

  await concurrentMap(files, async (filePath, idx) => {
    const result = await processFile(filePath, idx, total, cfg, domains);
    results[idx] = result;
  }, concurrency);

  let blocksFound = 0;
  let blocksSkipped = 0;
  let filesSkippedSize = 0;
  let filesBinary = 0;

  for (const r of results) {
    blocksFound += r.blocks.length;
    if (r.skipped) blocksSkipped++;
    if (r.sizeSkipped) filesSkippedSize++;
  }

  const filesIndex = buildFilesIndex(results);

  process.stderr.write(`Scanned ${total} files, found ${blocksFound} blocks, skipped ${blocksSkipped}`);
  if (filesSkippedSize > 0) {
    process.stderr.write(`, ${filesSkippedSize} files over size limit`);
  }
  if (filesBinary > 0) {
    process.stderr.write(`, ${filesBinary} binary files skipped`);
  }
  process.stderr.write('\n');

  return {
    version: '1',
    generated: new Date().toISOString(),
    domains,
    files: filesIndex,
  };
}
// @traceit:end