// @traceit:start
// @traceit:title: CLI Module
// @traceit:description: Entry point. Parses args, routes to generate/validate/query/init commands.
// @traceit:domain: infrastructure
// @traceit:exports: main, runGenerate, runValidate, runQuery, runInit
// @traceit:depends: src/scanner.ts, src/writer.ts, src/config.ts, src/git.ts, src/validator.ts, src/query.ts

import * as fs from 'fs';
import * as path from 'path';
import { scan } from './scanner';
import { writeIndex } from './writer';
import { getConfig, initConfig } from './config';
import { validate } from './validator';
import { queryIndex } from './query';

function showHelp(): void {
  console.log(`
traceit - Zero-dependency CLI for AI agent code annotations

Usage:
  traceit <command> [options]

Commands:
  generate    Scan project and write traceit.json
  validate    Check annotations against git history
  query       Filter traceit.json by domain/file/keyword
  init        Create .traceit.config.json

Options:
  --help          Show this help
  --out <path>    Output file path
  --ignore <paths>  Comma-separated paths to ignore
  --ext <extensions>  Comma-separated file extensions
  --format json|text  Output format (default: json)
  --quiet         Suppress per-file progress (summary only)
  --max-files <n>  Stop after scanning n files
  --max-depth <n>  Limit directory traversal depth
  --domain <name>  Filter by domain (query)
  --file <path>   Filter by file (query)
  --keyword <word>  Filter by keyword (query)
  --danger        Only blocks with danger field (query)

Examples:
  traceit generate
  traceit generate --out ./docs/traceit.json
  traceit generate --quiet --max-files 5000
  traceit validate --format json
  traceit query --domain billing
  traceit init
`);
}

function parseArgs(args: string[]): Record<string, string | boolean | string[]> {
  const result: Record<string, any> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        const value = args[i + 1];
        if (key === 'ignore' || key === 'ext') {
          result[key] = value.split(',');
        } else {
          result[key] = value;
        }
        i++;
      } else {
        result[key] = true;
      }
    } else if (!arg.startsWith('-')) {
      result._command = arg;
    }
  }
  
  return result;
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const parsed = parseArgs(args);
  const command = parsed._command as string;

  switch (command) {
    case 'generate':
      await runGenerate(parsed);
      break;
    case 'validate':
      await runValidate(parsed.format as 'json' | 'text' | undefined, parsed.out as string | undefined);
      break;
    case 'query':
      await runQuery(parsed);
      break;
    case 'init':
      runInit();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function runGenerate(parsed: Record<string, any>): Promise<void> {
  const config = getConfig();

  if (parsed.out) {
    config.out = parsed.out as string;
  }
  if (parsed.quiet === true) {
    config.progress = 'summary';
  }
  if (parsed['max-files'] !== undefined) {
    config.maxFiles = parseInt(parsed['max-files'] as string, 10) || 0;
  }
  if (parsed['max-depth'] !== undefined) {
    config.maxDepth = parseInt(parsed['max-depth'] as string, 10) || 0;
  }

  const index = await scan(config);
  await writeIndex(index, parsed.out as string | undefined);
}

function formatValidateReport(report: any): string {
  const lines: string[] = [];
  lines.push(`Status: ${report.status}`);
  lines.push(`Generated: ${report.generated}`);
  lines.push('');

  if (report.stale_blocks.length > 0) {
    lines.push(`Stale Blocks (${report.stale_blocks.length}):`);
    for (const b of report.stale_blocks) {
      lines.push(`  ${b.file} - ${b.title}`);
      lines.push(`    Annotation: ${b.last_annotation_change}, Code: ${b.last_code_change}`);
      if (b.changed_lines.length > 0) {
        lines.push(`    Changed lines: ${b.changed_lines.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (report.broken_depends.length > 0) {
    lines.push(`Broken Depends (${report.broken_depends.length}):`);
    for (const b of report.broken_depends) {
      lines.push(`  ${b.file} - ${b.title}: missing ${b.missing_path}`);
    }
    lines.push('');
  }

  if (report.missing_annotation.length > 0) {
    lines.push(`Missing Annotations (${report.missing_annotation.length}):`);
    for (const b of report.missing_annotation) {
      lines.push(`  ${b.file} (${b.days_since_change} days since last change)`);
    }
    lines.push('');
  }

  if (report.missing_fields.length > 0) {
    lines.push(`Missing Fields (${report.missing_fields.length}):`);
    for (const b of report.missing_fields) {
      lines.push(`  ${b.file} - ${b.title}: missing ${b.missing.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatQueryResult(result: any): string {
  const lines: string[] = [];
  lines.push(`Query: ${JSON.stringify(result.query)}`);
  lines.push(`Results: ${result.results.length}`);
  lines.push('');

  for (const r of result.results) {
    lines.push(`  ${r.file} - ${r.title}`);
    lines.push(`    Domain: ${r.domain || '(none)'}`);
    lines.push(`    Description: ${r.description}`);
    if (r.exports) lines.push(`    Exports: ${r.exports.join(', ')}`);
    if (r.depends) lines.push(`    Depends: ${r.depends.join(', ')}`);
    if (r.danger) lines.push(`    Danger: ${r.danger}`);
    lines.push('');
  }

  return lines.join('\n');
}

async function runValidate(format: 'json' | 'text' = 'json', outPath?: string): Promise<void> {
  const result = validate();
  
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  }
  
  if (format === 'text') {
    console.log(formatValidateReport(result));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  
  if (result.stale_blocks.length > 0 || result.broken_depends.length > 0) {
    process.exit(1);
  }
}

async function runQuery(args: Record<string, any>): Promise<void> {
  const config = getConfig();
  const indexPath = path.join(process.cwd(), config.out);
  
  if (!fs.existsSync(indexPath)) {
    console.error('traceit.json not found. Run "traceit generate" first.');
    process.exit(2);
  }
  
  const raw = fs.readFileSync(indexPath, 'utf-8');
  const index = JSON.parse(raw);
  
  const options = {
    domain: args.domain as string | undefined,
    file: args.file as string | undefined,
    keyword: args.keyword as string | undefined,
    danger: args.danger === true,
    format: (args.format as 'json' | 'text') || 'json',
  };
  
  const result = queryIndex(index, options);
  
  if (options.format === 'text') {
    console.log(formatQueryResult(result));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

function runInit(): void {
  initConfig();
}
// @traceit:end