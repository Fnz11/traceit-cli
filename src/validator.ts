// @traceit:start
// @traceit:title: Validator Module
// @traceit:description: Validates annotations against git history. Checks stale blocks, broken depends, missing annotations.
// @traceit:domain: infrastructure
// @traceit:exports: validate
// @traceit:depends: src/types.ts, src/git.ts, src/config.ts, src/scanner.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ValidationReport, StaleBlock, BrokenDep, MissingAnnotation, MissingField, TraceitIndex } from './types';
import { getFileBlame, isGitRepo, BlameLine } from './git';
import { getConfig } from './config';

function getMaxTimestamp(blame: BlameLine[], startLine: number, endLine: number): number {
  let maxTime = 0;
  for (let i = startLine - 1; i < endLine && i < blame.length; i++) {
    if (blame[i] && blame[i].authorTime > maxTime) {
      maxTime = blame[i].authorTime;
    }
  }
  return maxTime;
}

function getRecentlyModifiedFiles(days: number): string[] {
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const output = execSync(
      `git log --since="${since}" --name-only --pretty=format: --diff-filter=AM`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    return [...new Set(output.split('\n').map(f => f.trim()).filter(f => f))];
  } catch {
    return [];
  }
}

export function validate(): ValidationReport {
  const config = getConfig();
  const indexPath = path.join(process.cwd(), config.out);

  if (!fs.existsSync(indexPath)) {
    console.error('traceit.json not found. Run "traceit-cli generate" first.');
    process.exit(2);
  }

  if (!isGitRepo()) {
    console.error('Not a git repository. Run "traceit-cli validate" in a git repo.');
    process.exit(2);
  }

  const raw = fs.readFileSync(indexPath, 'utf-8');
  const index: TraceitIndex = JSON.parse(raw);

  const stale_blocks: StaleBlock[] = [];
  const broken_depends: BrokenDep[] = [];
  const missing_annotation: MissingAnnotation[] = [];
  const missing_fields: MissingField[] = [];

  const allBlocks: Array<{ file: string; block: any }> = [];

  function flattenFiles(obj: any, prefix: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}/${key}` : key;
      if (Array.isArray(value)) {
        for (const block of value) {
          allBlocks.push({ file: currentPath, block });
        }
      } else if (typeof value === 'object' && value !== null) {
        flattenFiles(value, currentPath);
      }
    }
  }

  flattenFiles(index.files);

  console.log(`Validating ${allBlocks.length} blocks across ${new Set(allBlocks.map(b => b.file)).size} files...`);

  const blameCache: Map<string, BlameLine[]> = new Map();

  for (const { file, block } of allBlocks) {
    const fullPath = path.join(process.cwd(), file);

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const required = ['title', 'description'];
    const missing = required.filter(f => !block[f]);
    if (missing.length > 0) {
      missing_fields.push({ file, title: block.title, missing });
    }

    const [codeStart, codeEnd] = block.codeLines;
    const [blockStart, blockEnd] = block.blockLines;
    
    let blame: BlameLine[];
    if (blameCache.has(fullPath)) {
      blame = blameCache.get(fullPath)!;
    } else {
      blame = getFileBlame(fullPath);
      blameCache.set(fullPath, blame);
    }

    if (blame.length > 0) {
      const codeTime = getMaxTimestamp(blame, codeStart, codeEnd);
      const annotTimeBefore = getMaxTimestamp(blame, blockStart, codeStart - 1);
      const annotTimeAfter = getMaxTimestamp(blame, codeEnd + 1, blockEnd);
      const annotTime = Math.max(annotTimeBefore, annotTimeAfter);

      if (codeTime > annotTime) {
        const changedLines: number[] = [];
        for (let i = codeStart - 1; i < codeEnd && i < blame.length; i++) {
          if (blame[i] && blame[i].authorTime > annotTime) {
            changedLines.push(i + 1);
          }
        }

        stale_blocks.push({
          file,
          title: block.title,
          lines: block.codeLines,
          last_annotation_change: annotTime > 0 ? new Date(annotTime * 1000).toISOString() : '',
          last_code_change: codeTime > 0 ? new Date(codeTime * 1000).toISOString() : '',
          changed_lines: changedLines,
          diff: '',
        });
      }
    }

    if (block.depends) {
      for (const dep of block.depends) {
        const depPath = path.isAbsolute(dep) ? dep : path.join(process.cwd(), dep);
        if (!fs.existsSync(depPath)) {
          broken_depends.push({
            file,
            title: block.title,
            missing_path: dep,
          });
        }
      }
    }
  }

  const modifiedFiles = getRecentlyModifiedFiles(config.warnUnchangedDays);
  const annotatedFiles = new Set(allBlocks.map(b => b.file));
  for (const file of modifiedFiles) {
    if (!annotatedFiles.has(file)) {
      const ext = path.extname(file).slice(1);
      if (config.ext.includes(ext) && !config.ignore.some(i => file.startsWith(i + path.sep) || file.includes(path.sep + i + path.sep))) {
        try {
          const logOutput = execSync(`git log -1 --format=%ct "${file}"`, { encoding: 'utf-8', cwd: process.cwd() });
          const lastCommitTime = parseInt(logOutput.trim(), 10);
          const daysSinceChange = Math.floor((Date.now() / 1000 - lastCommitTime) / 86400);
          missing_annotation.push({ file, days_since_change: daysSinceChange });
        } catch {}
      }
    }
  }

  const hasIssues = stale_blocks.length > 0 || broken_depends.length > 0 || missing_annotation.length > 0;

  return {
    generated: index.generated,
    status: hasIssues ? 'stale' : 'clean',
    stale_blocks,
    broken_depends,
    missing_annotation,
    missing_fields,
  };
}
// @traceit:end