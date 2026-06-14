// @traceit:start
// @traceit:title: Types Module
// @traceit:description: Shared TypeScript interfaces for traceit. Defines all data structures used across scanner, validator, query, and CLI.
// @traceit:domain: infrastructure
// @traceit:exports: TraceitConfig, TraceitBlock, TraceitFile, TraceitIndex, ValidationReport, QueryOptions

export interface TraceitConfig {
  out: string;
  ignore: string[];
  ext: string[];
  warnUnchangedDays: number;
  maxFiles: number;
  maxDepth: number;
  progress: 'lines' | 'periodic' | 'summary';
}

export interface TraceitBlock {
  title: string;
  description: string;
  domain: string | null;
  exports: string[] | null;
  depends: string[] | null;
  danger: string | null;
  codeLines: [number, number];
  blockLines: [number, number];
}

export interface TraceitFile {
  [key: string]: TraceitBlock[];
}

export interface TraceitIndex {
  version: string;
  generated: string;
  domains: Record<string, string[]>;
  files: Record<string, any>;
}

export interface ValidationReport {
  generated: string;
  status: 'clean' | 'stale';
  stale_blocks: StaleBlock[];
  broken_depends: BrokenDep[];
  missing_annotation: MissingAnnotation[];
  missing_fields: MissingField[];
}

export interface StaleBlock {
  file: string;
  title: string;
  lines: [number, number];
  last_annotation_change: string;
  last_code_change: string;
  changed_lines: number[];
  diff: string;
}

export interface BrokenDep {
  file: string;
  title: string;
  missing_path: string;
}

export interface MissingAnnotation {
  file: string;
  days_since_change: number;
}

export interface MissingField {
  file: string;
  title: string;
  missing: string[];
}

export interface QueryOptions {
  domain?: string;
  file?: string;
  keyword?: string;
  danger?: boolean;
  format?: 'json' | 'text';
}

export interface ParsedAnnotation {
  fields: Record<string, string>;
  startLine: number;
  endLine: number;
  codeStartLine: number;
  codeEndLine: number;
}
// @traceit:end