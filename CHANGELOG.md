# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-06-15

### Fixed

- **Critical: parseBlock infinite loop**: Fixed bug where missing `@traceit:end` tag caused infinite loop by initializing `endLine = -1` instead of `startLine`. Now returns `null` if no end tag found.
- **Validate performance**: Added blame cache to prevent running `git blame` multiple times on same file. Validates once per file instead of once per block (10-100x faster on large codebases).
- **Concurrency race condition**: Removed shared `domains` object mutation across workers. Each worker now uses local domains, merged after completion.
- **Windows console blocking**: Changed all `process.stderr.write` to `process.stdout.write` to avoid Windows terminal pipeline saturation during concurrent file scanning.

### Changed

- Reduced `FILE_TIMEOUT` from 30s to 5s for faster failure detection on problematic files.
- Removed artificial 10ms stagger between file processing (was causing unnecessary slowdown).
- Removed timeout wrapper around `processFile` (timeouts don't work with sync I/O, user can Ctrl+C if needed).

## [0.1.1] - 2026-06-15

### Added

- **Fuzzy keyword search**: tokenizes query into words, scores blocks by relevance across title (4×), domain (3×), description/exports (2×), depends/danger (1×). Returns ranked results with match percentages.
- **`--top <n>` flag** (query): limit results to top N (default 20). Prevents terminal flood on large indexes.
- **`--verbose` flag** (query): show full block details (file, domain, description, exports, depends, matches). Default is compact ranked list with score and matching keywords.
- **`--out <path>` flag** (query): write query results to file instead of stdout.
- **`--debug` flag**: prints per-file timing (stat, read, parse), walkDir/gitignore duration, and total scan time. Helps diagnose slow scans on large codebases.
- **`--version` / `-v` flag**: prints `traceit-cli vX.Y.Z` and exits.
- **`--sequential` flag**: processes files one at a time, avoiding Windows async I/O pipeline contention on some systems.
- Flags without a command now show help instead of "Unknown command".

### Fixed

- **Per-file timeout**: files that hang during read (Windows edge case) skip after 30s instead of freezing the entire scan pool.
- **`filterGitIgnored` batching**: git check-ignore now called in batches of 50 to avoid Windows cmd.exe 8191-character limit (caused hang on large repos).
- **`validate --out` format**: output file now respects `--format text` — writes text report instead of always JSON. Suppresses stdout flood when writing to file.

### Changed

- Help text: added `validate --out`, `validate --format text`, `--version`, `--debug` examples.

## [0.1.0] - 2026-06-14

### Added

- Core scan: walks directories, finds `@traceit:start`/`@traceit:end` blocks, parses annotation fields.
- Commands: `generate`, `validate`, `query`, `init`.
- Validate checks: stale blocks (git-based), broken depends, missing annotations, missing fields.
- Query filters: by domain, file, keyword, danger flag.
- Config from `.traceit.config.json` with sensible defaults.
- `.gitignore` awareness via `git check-ignore`.
- File size guard (1MB limit before read).
- Binary file detection (null byte check in first 512 bytes).
- Concurrent file scanning with `os.cpus().length` worker pool.
- Progress modes: `lines`, `periodic` (every 100), `summary` (`--quiet`).
- Configurable `maxFiles` and `maxDepth` limits.
- Config validation with early-exit on errors.
- CLI flags: `--quiet`, `--max-files`, `--max-depth`, `--out`, `--format`, etc.
- Dogfooding: the tool annotates itself with `@traceit` blocks.

### Changed

- `lines` field renamed to `codeLines` in `TraceitBlock` and JSON output.
- Stale detection uses git blame timestamps on annotation vs code line ranges.
- Progress output uses newlines on stderr (not `\r` overwrites).

### Fixed

- `parseBlock` now correctly strips comment prefix before checking `@traceit:start`/`@traceit:end`.
- `stripComment` handles `/* */` trailing `*/` correctly.
- Code line detection in `parseBlock` uses stripped content.
- Text format works for `validate` and `query` (was identical to JSON).
- `missing_annotation` check is fully implemented.

<!-- Versions -->
[0.1.2]: https://github.com/Fnz11/traceit/releases/tag/v0.1.2
[0.1.1]: https://github.com/Fnz11/traceit-cli/releases/tag/v0.1.1
[0.1.0]: https://github.com/Fnz11/traceit-cli/releases/tag/v0.1.0
