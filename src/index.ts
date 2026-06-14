// @traceit:start
// @traceit:title: Index Module
// @traceit:description: Main export barrel. Re-exports all public functions.
// @traceit:domain: infrastructure
// @traceit:exports: scan, writeIndex, validate, queryIndex, getConfig, initConfig, main
// @traceit:depends: src/scanner.ts, src/writer.ts, src/validator.ts, src/query.ts, src/config.ts, src/cli.ts

export { scan } from './scanner';
export { writeIndex } from './writer';
export { validate } from './validator';
export { queryIndex } from './query';
export { getConfig, initConfig, DEFAULT_CONFIG } from './config';
export { main } from './cli';
// @traceit:end

// @traceit:end
