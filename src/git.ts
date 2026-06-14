// @traceit:start
// @traceit:title: Git Module
// @traceit:description: Wrapper for git blame. Gets last commit date per line range for validation.
// @traceit:domain: infrastructure
// @traceit:exports: getLastChangeForLines, isGitRepo, getFileBlame

import { execSync } from 'child_process';
import * as path from 'path';

export function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore', cwd: process.cwd() });
    return true;
  } catch {
    return false;
  }
}

export function getFileBlame(filePath: string): BlameLine[] {
  try {
    const output = execSync(`git blame --line-porcelain "${filePath}"`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    const lines: BlameLine[] = [];
    const rawLines = output.split('\n');
    let currentLine: Partial<BlameLine> = {};

    for (const raw of rawLines) {
      if (raw.startsWith('author-time ')) {
        currentLine.authorTime = parseInt(raw.split(' ')[1], 10);
      } else if (raw.startsWith('summary ')) {
        currentLine.summary = raw.slice(8);
      } else if (/^\t/.test(raw)) {
        currentLine.content = raw.slice(1);
        if (currentLine.authorTime) {
          lines.push({
            line: lines.length + 1,
            authorTime: currentLine.authorTime,
            summary: currentLine.summary || '',
            content: currentLine.content,
          });
        }
        currentLine = {};
      }
    }

    return lines;
  } catch {
    return [];
  }
}

export function getLastChangeForLines(
  filePath: string,
  startLine: number,
  endLine: number
): { date: string; lines: number[] } | null {
  const blame = getFileBlame(filePath);

  if (blame.length === 0) return null;

  let latestTime = 0;
  const changedLines: number[] = [];

  for (let i = startLine - 1; i < endLine && i < blame.length; i++) {
    if (blame[i] && blame[i].authorTime > latestTime) {
      latestTime = blame[i].authorTime;
    }
  }

  if (latestTime === 0) return null;

  for (let i = startLine - 1; i < endLine && i < blame.length; i++) {
    if (blame[i] && blame[i].authorTime === latestTime) {
      changedLines.push(i + 1);
    }
  }

  const date = new Date(latestTime * 1000).toISOString();

  return { date, lines: changedLines };
}

export interface BlameLine {
  line: number;
  authorTime: number;
  summary: string;
  content: string;
}
// @traceit:end