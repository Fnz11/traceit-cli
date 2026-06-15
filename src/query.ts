// @traceit:start
// @traceit:title: Query Module
// @traceit:description: Filters traceit.json by domain, file, keyword, or danger flag. Supports fuzzy multi-word search with relevance ranking.
// @traceit:domain: infrastructure
// @traceit:exports: queryIndex
// @traceit:depends: src/types.ts

import { TraceitIndex, QueryOptions } from './types';

interface ScoredResult {
  file: string;
  block: any;
  score: number;
  matches: string[];
}

const SCORE_WEIGHTS: Record<string, number> = {
  title: 4,
  domain: 3,
  description: 2,
  exports: 2,
  depends: 1,
  danger: 1,
};

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
}

function fuzzyScore(queryWords: string[], block: any): { score: number; matches: string[] } {
  let totalWeight = 0;
  let matchedWeight = 0;
  const matches: string[] = [];

  for (const [field, weight] of Object.entries(SCORE_WEIGHTS)) {
    const value = block[field];
    if (!value) continue;
    const text = Array.isArray(value) ? value.join(' ') : String(value);
    const lower = text.toLowerCase();

    for (const word of queryWords) {
      totalWeight += weight;
      if (lower.includes(word)) {
        matchedWeight += weight;
        if (!matches.includes(word)) matches.push(word);
      }
    }
  }

  return { score: totalWeight > 0 ? matchedWeight / totalWeight : 0, matches };
}

export function queryIndex(index: TraceitIndex, options: QueryOptions): any {
  const queryWords = options.keyword ? tokenize(options.keyword) : [];
  const top = options.top || 20;

  function flattenFiles(obj: any, prefix: string = ''): Array<{ file: string; block: any }> {
    const result: Array<{ file: string; block: any }> = [];

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}/${key}` : key;
      if (Array.isArray(value)) {
        for (const block of value) {
          result.push({ file: currentPath, block });
        }
      } else if (typeof value === 'object' && value !== null) {
        result.push(...flattenFiles(value, currentPath));
      }
    }

    return result;
  }

  const allBlocks = flattenFiles(index.files);
  const scored: ScoredResult[] = [];

  for (const { file, block } of allBlocks) {
    let include = true;

    if (options.domain) {
      include = include && block.domain === options.domain;
    }

    if (options.file) {
      include = include && file === options.file;
    }

    if (options.danger) {
      include = include && block.danger !== null && block.danger !== undefined;
    }

    if (queryWords.length > 0) {
      const { score, matches } = fuzzyScore(queryWords, block);
      if (score < 0.2) include = false;
      if (include) {
        scored.push({ file, block, score, matches });
      }
    } else if (include) {
      scored.push({ file, block, score: 1, matches: [] });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const limited = scored.slice(0, top);

  return {
    query: {
      domain: options.domain,
      file: options.file,
      keyword: options.keyword,
      danger: options.danger,
    },
    total_matches: scored.length,
    shown: limited.length,
    results: limited.map(r => ({
      file: r.file,
      title: r.block.title,
      description: r.block.description,
      domain: r.block.domain,
      exports: r.block.exports,
      depends: r.block.depends,
      danger: r.block.danger,
      codeLines: r.block.codeLines,
      score: r.score < 1 ? Math.round(r.score * 100) + '%' : undefined,
      matches: r.matches.length > 0 ? r.matches : undefined,
    })),
  };
}
// @traceit:end