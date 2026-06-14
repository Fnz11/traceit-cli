// @traceit:start
// @traceit:title: Writer Module
// @traceit:description: Serializes and writes traceit.json. Handles output path from config or CLI override.
// @traceit:domain: infrastructure
// @traceit:exports: writeIndex
// @traceit:depends: src/types.ts, src/config.ts

import { promises as fs } from 'fs';
import * as path from 'path';
import { TraceitIndex } from './types';
import { getConfig } from './config';

export async function writeIndex(index: TraceitIndex, outPath?: string): Promise<void> {
  const targetPath = outPath || getConfig().out;
  const dir = path.dirname(targetPath);

  if (dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(targetPath, JSON.stringify(index, null, 2));
  console.log(`Wrote ${targetPath}`);
}
// @traceit:end