<a id="readme-top"></a>

[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<br />
<div align="center">
  <h3 align="center">traceit</h3>

  <p align="center">
   Zero-dependency CLI that indexes code annotations for AI agents
    <br />
    <a href="https://github.com/Fnz11/traceit"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/Fnz11/traceit/issues/new?labels=bug">Report Bug</a>
    ·
    <a href="https://github.com/Fnz11/traceit/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#problem">Problem</a></li>
        <li><a href="#solution">Solution</a></li>
      </ul>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
      <ul>
        <li><a href="#features">Features</a></li>
      </ul>
      <ul>
        <li><a href="#file-structure">File Structure</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
       <ul>
          <li><a href="#annotation-syntax">Annotation Syntax</a></li>
          <li><a href="#commands">Commands</a></li>
       </ul>
    </li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About The Project

### Problem

AI coding agents have no persistent memory of a codebase between sessions. Every new session re-explores the project tree, re-reads files, re-infers functions — burning thousands of tokens and hallucinating file paths.

### Solution

`traceit` reads structured annotation comments (`@traceit:*`) written inside source files and generates a single `traceit.json` index. Any agent reads one file and knows what every annotated block does, what it exports, what it depends on, and whether its docs are up to date.

```typescript
// @traceit:start
// @traceit:title: Stripe Webhook Handler
// @traceit:description: Validates Stripe signature and routes events.
// @traceit:domain: billing
// @traceit:exports: handleStripeWebhook
// @traceit:depends: src/services/billing.ts
export function handleStripeWebhook(req: Request, res: Response) {
  // implementation
}
// @traceit:end
```

Works with any language — comments only, no AST.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![TypeScript][TypeScript]][TypeScript-url]
* [![Node][Node.js]][Node-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Features
- **Language-agnostic** — reads comments, not AST. Works with TS, Go, Python, Rust, PHP, Java, Ruby, C#
- **Zero dependencies** — stdlib only. `fs`, `path`, `child_process`
- **Agent-first output** — JSON schema optimized for LLM consumption
- **Stale detection** — `validate` command checks annotations against git history
- **Fuzzy search** — tokenizes query, scores by relevance across title/description/domain/exports/depends, ranks results
- **Terminal-friendly** — compact ranked output, `--top <n>` limits results, `--verbose` for full details
- **Self-healing** — stale report feeds back into agent loop for auto-updates
- **Large codebase ready** — concurrent scanning, `.gitignore` awareness, binary detection, configurable file/depth limits
- **Minimal output** — periodic or summary-only progress modes avoid stderr noise

## Getting Started

### Prerequisites

* Node.js >= 18
* Git 2.x (required for `validate` command)

### Installation

```sh
npx traceit-cli init
```

No install needed — run directly via `npx`. The `init` command scaffolds a config file.

### First-time setup

Run `npx traceit-cli init`, then paste this prompt to your AI agent:

````markdown
Annotate every logical unit (function, class, module, API route) with `@traceit:*` blocks.

### Syntax

Wrap code between `// @traceit:start` and `// @traceit:end`. Annotations lines go above the code, inside the block.

```typescript
// @traceit:start
// @traceit:title: Stripe Webhook Handler
// @traceit:description: Validates Stripe signature and routes incoming events to billing service.
// @traceit:domain: billing
// @traceit:exports: handleStripeWebhook, verifyStripeSignature
// @traceit:depends: src/services/billing.ts, src/models/subscription.ts
// @traceit:danger: Never modify signature verification without reading Stripe docs
export function handleStripeWebhook(req: Request, res: Response) {
  // implementation
}
// @traceit:end
```

Works in any language — just use the correct comment syntax (`#` for Python, `--` for SQL, etc.).

### Fields

| Field | Required | Description |
|---|---|---|
| `@traceit:start` | ✅ | Opens annotation block |
| `@traceit:end` | ✅ | Closes block. Code being described lives between these |
| `@traceit:title` | ✅ | Short name for this block |
| `@traceit:description` | ✅ | What this block does. Write for an agent that has never seen this file |
| `@traceit:domain` | ⬜ | Logical grouping (e.g. `auth`, `billing`, `infra`) |
| `@traceit:exports` | ⬜ | Comma-separated list of exported identifiers |
| `@traceit:depends` | ⬜ | Comma-separated file paths this block depends on |
| `@traceit:danger` | ⬜ | Critical warning for agents |

### Rules
- One file can have multiple blocks (one per logical unit)
- Blocks cannot nest
- Fields are case-insensitive

After annotating all files, run: `npx traceit-cli generate`
````

The agent will annotate every file, then generate `traceit.json`.

### Agent instructions (CLAUDE.md / AGENTS.md)

Add this to your `CLAUDE.md` or `AGENTS.md` so every agent session reads from traceit and keeps annotations fresh:

````markdown
## traceit — codebase indexing

This project uses `traceit` to index code annotations for AI agents.

### Annotation syntax

Wrap code between `// @traceit:start` and `// @traceit:end`. Fields go above the code:

```typescript
// @traceit:start
// @traceit:title: Stripe Webhook Handler
// @traceit:description: Validates Stripe signature and routes events to billing.
// @traceit:domain: billing
// @traceit:exports: handleStripeWebhook
// @traceit:depends: src/services/billing.ts
// @traceit:danger: Never modify signature verification without reading Stripe docs
export function handleStripeWebhook(req: Request, res: Response) {
  // implementation
}
// @traceit:end
```

| Field | Required | Description |
|---|---|---|
| `@traceit:start` | ✅ | Opens annotation block |
| `@traceit:end` | ✅ | Closes block. Code being described lives between these |
| `@traceit:title` | ✅ | Short name for this block |
| `@traceit:description` | ✅ | What this block does. Write for an agent |
| `@traceit:domain` | ⬜ | Logical grouping (e.g. `auth`, `billing`) |
| `@traceit:exports` | ⬜ | Comma-separated exported identifiers |
| `@traceit:depends` | ⬜ | Comma-separated file paths this block depends on |
| `@traceit:danger` | ⬜ | Critical warning for agents |

### On every session start
1. Read `traceit.json` at the project root to understand the codebase
2. Run `npx traceit-cli validate` to check if annotations are still accurate
3. Use `npx traceit-cli query --domain <name>` to get context for a specific domain
4. Use `npx traceit-cli query --keyword "<fuzzy search>"` to find blocks by relevance — results are ranked with match scores
5. Only open source files when traceit tells you they are relevant to your task

### After making code changes
1. Update `@traceit:description`, `@traceit:exports`, `@traceit:depends` on any blocks you modified
2. Run `npx traceit-cli generate` to rebuild the index — this must be the very last step
3. If CI fails with stale blocks, read the stale report and update the annotations
````

This ensures your agent always indexes from `traceit.json` and keeps annotations in sync with code changes.

## Usage

### Annotation Syntax

Place `@traceit:start` / `@traceit:end` markers around any code block. Fields go between them:

| Field | Required | Description |
|---|---|---|
| `@traceit:start` | ✅ | Opens annotation block |
| `@traceit:end` | ✅ | Closes block. Code being described lives between these |
| `@traceit:title` | ✅ | Short name for this block |
| `@traceit:description` | ✅ | What this block does. Write for an agent |
| `@traceit:domain` | ⬜ | Logical grouping (e.g. `auth`, `billing`) |
| `@traceit:exports` | ⬜ | Comma-separated exported identifiers |
| `@traceit:depends` | ⬜ | Comma-separated file paths this block depends on |
| `@traceit:danger` | ⬜ | Critical warning for agents |

### Commands

```sh
# Scan project and generate traceit.json
npx traceit-cli generate

# Quiet mode — summary output only
npx traceit-cli generate --quiet

# Limit file count or directory depth (large repos)
npx traceit-cli generate --max-files 5000 --max-depth 5

# Check annotations against git history
npx traceit-cli validate

# Filter the index
npx traceit-cli query --domain billing

# Fuzzy keyword search — ranked by relevance
npx traceit-cli query --keyword "stripe webhook"
npx traceit-cli query --keyword "cli scan" --top 5
npx traceit-cli query --keyword "db query" --verbose
npx traceit-cli query --keyword "ai agent" --top 10 --out results.txt

# Scaffold config
npx traceit-cli init
```

Options: `--out`, `--ignore`, `--ext`, `--format`, `--quiet`, `--max-files`, `--max-depth`, `--domain`, `--file`, `--keyword`, `--danger`, `--top`, `--verbose`, `--debug`, `--version`, `--sequential`.

### Configuration

`.traceit.config.json` supports these fields:

| Field | Default | Description |
|-------|---------|-------------|
| `out` | `traceit.json` | Output file path |
| `ignore` | `node_modules, .git, dist, ...` | Directories to skip |
| `ext` | `ts, tsx, js, jsx, go, py, rs, ...` | File extensions to scan |
| `warnUnchangedDays` | `90` | Days threshold for `validate` |
| `maxFiles` | `0` (unlimited) | Stop after scanning N files |
| `maxDepth` | `0` (unlimited) | Limit directory traversal depth |
| `progress` | `periodic` | Progress mode: `lines`, `periodic`, or `summary` |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### File Structure
```
traceit/
├── src/
│   ├── cli.ts           # Arg parsing, command routing
│   ├── scanner.ts       # Walk dirs, find @traceit blocks, parse fields
│   ├── git.ts           # git blame wrapper, last-commit-date per line
│   ├── validator.ts     # Compare annotation vs code blame, check depends
│   ├── query.ts         # Filter traceit.json by domain/file/keyword
│   ├── writer.ts        # Serialize and write traceit.json
│   ├── config.ts        # Load .traceit.config.json with defaults
│   └── types.ts         # Shared TypeScript interfaces
├── bin/
│   └── traceit.js       # CLI entry point
├── tests/
│   ├── fixtures/        # Sample files with @traceit annotations
│   └── scanner.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── traceit.json         # The tool annotates itself (dogfood)
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Fikri Nurdiansyah

[![gmail][gmail]][gmail-url]
[![tele][tele]][tele-url]
[![linkedin][linkedin-shield]][linkedin-url]

Project Link: [https://github.com/Fnz11/traceit](https://github.com/Fnz11/traceit)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

[forks-shield]: https://img.shields.io/github/forks/Fnz11/traceit.svg?style=for-the-badge
[forks-url]: https://github.com/Fnz11/traceit/network/members
[stars-shield]: https://img.shields.io/github/stars/Fnz11/traceit.svg?style=for-the-badge
[stars-url]: https://github.com/Fnz11/traceit/stargazers
[issues-shield]: https://img.shields.io/github/issues/Fnz11/traceit.svg?style=for-the-badge
[issues-url]: https://github.com/Fnz11/traceit/issues
[license-shield]: https://img.shields.io/github/license/Fnz11/traceit.svg?style=for-the-badge
[license-url]: https://github.com/Fnz11/traceit/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/fikri-nurdiansyah-214387286/
[tele]: https://img.shields.io/badge/Telegram-2CA5E0?style=flat-squeare&logo=telegram&logoColor=white
[tele-url]: https://t.me/ysfik
[gmail]: https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white
[gmail-url]: https://mail.google.com/mail/u/finz1112@gmail.com/#compose
[TypeScript]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Node.js]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/