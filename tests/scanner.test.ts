// @traceit:start
// @traceit:title: Scanner Tests
// @traceit:description: Tests for the scanner module
// @traceit:domain: test
// @traceit:exports: (test file)
// @traceit:end

import * as fs from 'fs';
import * as path from 'path';
import { scan, parseBlock, getCommentPrefix, stripComment, walkDir } from '../src/scanner';

describe('Scanner', () => {
  const testDir = path.join(__dirname, 'fixtures');
  const originalCwd = process.cwd();

  beforeAll(() => {
    process.chdir(testDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  describe('getCommentPrefix', () => {
    it('detects // comments', () => {
      expect(getCommentPrefix('// some comment')).toBe('//');
      expect(getCommentPrefix('  // indented')).toBe('//');
    });

    it('detects # comments', () => {
      expect(getCommentPrefix('# python comment')).toBe('#');
    });

    it('detects -- comments', () => {
      expect(getCommentPrefix('-- sql comment')).toBe('--');
    });

    it('detects /* comments', () => {
      expect(getCommentPrefix('/* block comment */')).toBe('/*');
    });

    it('returns null for non-comments', () => {
      expect(getCommentPrefix('regular code')).toBeNull();
    });
  });

  describe('stripComment', () => {
    it('strips // prefix', () => {
      expect(stripComment('// @traceit:title: Test', '//')).toBe('@traceit:title: Test');
    });

    it('strips # prefix', () => {
      expect(stripComment('# @traceit:title: Test', '#')).toBe('@traceit:title: Test');
    });

    it('strips /* prefix and trailing */', () => {
      expect(stripComment('/* @traceit:title: Test */', '/*')).toBe('@traceit:title: Test');
    });
  });

  describe('walkDir', () => {
    it('finds files with matching extensions', async () => {
      const files = await walkDir(testDir, ['node_modules', '.git'], ['ts', 'js']);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.endsWith('.ts'))).toBe(true);
    });

    it('ignores specified child directories', async () => {
      const testsDir = path.join(__dirname);
      const files = await walkDir(testsDir, ['fixtures'], ['ts']);
      expect(files.some(f => f.includes('fixtures'))).toBe(false);
      expect(files.some(f => f.endsWith('scanner.test.ts'))).toBe(true);
    });
  });

  describe('parseBlock', () => {
    it('parses a valid annotation block', () => {
      const content = fs.readFileSync(path.join(testDir, 'sample.ts'), 'utf-8');
      const lines = content.split('\n');
      const result = parseBlock(lines, 0);
      expect(result).not.toBeNull();
      expect(result!.fields.title).toBe('Sample Function');
      expect(result!.fields.description).toBe('A sample function for testing');
      expect(result!.fields.domain).toBe('test');
      expect(result!.fields.exports).toBe('sampleFunc');
      expect(result!.codeStartLine).toBe(6);
      expect(result!.codeEndLine).toBe(8);
      expect(result!.startLine).toBe(1);
      expect(result!.endLine).toBe(9);
    });

    it('returns null when file has no @traceit:start', () => {
      const lines = [
        'const x = 1;',
        'const y = 2;',
      ];
      expect(parseBlock(lines, 0)).toBeNull();
    });

    it('correctly identifies code lines between annotations', () => {
      const lines = [
        '// @traceit:start',
        '// @traceit:title: Test',
        '// @traceit:description: Desc',
        'function foo() {',
        '  return 42;',
        '}',
        '// @traceit:end',
      ];
      const result = parseBlock(lines, 0);
      expect(result).not.toBeNull();
      expect(result!.codeStartLine).toBe(4);
      expect(result!.codeEndLine).toBe(6);
      expect(result!.startLine).toBe(1);
      expect(result!.endLine).toBe(7);
    });

    it('handles blocks with no code content', () => {
      const lines = [
        '// @traceit:start',
        '// @traceit:title: Empty',
        '// @traceit:description: Empty block',
        '// @traceit:end',
      ];
      expect(parseBlock(lines, 0)).toBeNull();
    });
  });

  describe('scan', () => {
    beforeAll(() => {
      process.chdir(testDir);
    });

    afterAll(() => {
      process.chdir(originalCwd);
    });

    it('scans fixture directory and finds annotated blocks', async () => {
      const result = await scan();
      expect(result.version).toBe('1');
      expect(result.domains).toHaveProperty('test');
      expect(Object.keys(result.files).length).toBeGreaterThan(0);
    });
  });
});