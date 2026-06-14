// @traceit:start
// @traceit:title: Config Module
// @traceit:description: Loads and merges .traceit.config.json with sensible defaults. Provides getConfig() for all commands.
// @traceit:domain: infrastructure
// @traceit:exports: getConfig, DEFAULT_CONFIG, loadConfigFile
// @traceit:depends: src/types.ts
import * as fs from 'fs';
import * as path from 'path';
import { TraceitConfig } from './types';

export const DEFAULT_CONFIG: TraceitConfig = {
  out: 'traceit.json',
  ignore: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'],
  ext: ['ts', 'tsx', 'js', 'jsx', 'go', 'py', 'rs', 'php', 'java', 'rb', 'cs'],
  warnUnchangedDays: 90,
  maxFiles: 0,
  maxDepth: 0,
  progress: 'periodic',
};

const CONFIG_FILE = '.traceit.config.json';

let _config: TraceitConfig | null = null;

export function getConfig(): TraceitConfig {
  if (!_config) {
    _config = loadConfigFile();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

export function loadConfigFile(): TraceitConfig {
  const configPath = path.join(process.cwd(), CONFIG_FILE);
  
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch (e) {
    console.warn(`Warning: failed to parse ${CONFIG_FILE}, using defaults`);
    return { ...DEFAULT_CONFIG };
  }
}

export function initConfig(): void {
  const configPath = path.join(process.cwd(), CONFIG_FILE);
  
  if (fs.existsSync(configPath)) {
    console.log(`${CONFIG_FILE} already exists`);
    return;
  }

  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  console.log(`Created ${CONFIG_FILE}`);
}
// @traceit:end