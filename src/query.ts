// @traceit:start
// @traceit:title: Query Module
// @traceit:description: Filters traceit.json by domain, file, keyword, or danger flag. Core of query command.
// @traceit:domain: infrastructure
// @traceit:exports: queryIndex
// @traceit:depends: src/types.ts

import { TraceitIndex, QueryOptions } from './types';

export function queryIndex(index: TraceitIndex, options: QueryOptions): any {
  const results: any[] = [];

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

  for (const { file, block } of allBlocks) {
    let include = true;

    if (options.domain) {
      include = include && block.domain === options.domain;
    }

    if (options.file) {
      include = include && file === options.file;
    }

    if (options.keyword) {
      const kw = options.keyword.toLowerCase();
      const titleMatch = block.title?.toLowerCase().includes(kw);
      const descMatch = block.description?.toLowerCase().includes(kw);
      include = include && (titleMatch || descMatch);
    }

    if (options.danger) {
      include = include && block.danger !== null && block.danger !== undefined;
    }

    if (include) {
      results.push({
        file,
        title: block.title,
        description: block.description,
        domain: block.domain,
        exports: block.exports,
        depends: block.depends,
        danger: block.danger,
        codeLines: block.codeLines,
      });
    }
  }

  return {
    query: {
      domain: options.domain,
      file: options.file,
      keyword: options.keyword,
      danger: options.danger,
    },
    results,
  };
}
// @traceit:end