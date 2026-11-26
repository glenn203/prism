#!/usr/bin/env node
/**
 * Decide how much of the Chromium suite CI should run from a changed-file list.
 *
 * Usage:
 *   node scripts/ci-test-mode.mjs --event pull_request [--] file [file...]
 *   git diff --name-only BASE HEAD | node scripts/ci-test-mode.mjs --event pull_request
 *
 * Prints `mode=`, `showcase=`, and `tests=` lines (tests is space-separated).
 * A push event always yields mode=full.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SHARED_DIRS = [
  'src/tokens/',
  'src/theme/',
  'src/internal/',
  'src/polish/',
  'tokens/',
  'scripts/',
];
const SHARED_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'src/index.ts',
  'src/define.ts',
  '.github/workflows/ci.yml',
]);
const SHARED_COMPONENT_DIRS = new Set([
  'tokens',
  'theme',
  'internal',
  'polish',
]);

export const isNonePath = (file) => {
  if (file.endsWith('.md')) return true;
  if (file.endsWith('.stories.ts')) return true;
  if (file.startsWith('showcase/')) return true;
  if (file.startsWith('docs/')) return true;
  if (file.startsWith('.storybook/')) return true;
  if (file === 'LICENSE' || file === '.gitignore' || file === '.editorconfig')
    return true;
  return false;
};

export const isSharedPath = (file) => {
  if (SHARED_FILES.has(file)) return true;
  if (/^playwright\.config\./.test(file)) return true;
  return SHARED_DIRS.some(
    (dir) => file === dir.slice(0, -1) || file.startsWith(dir),
  );
};

export const componentDirOf = (file) => {
  const match = file.match(/^src\/([^/]+)\//);
  if (!match) return null;
  const dir = match[1];
  if (SHARED_COMPONENT_DIRS.has(dir)) return null;
  return dir;
};

const testFilesIn = (dir) => {
  const folder = join(ROOT, 'src', dir);
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => `src/${dir}/${name}`)
    .sort();
};

export const detect = (event, files) => {
  const unique = [
    ...new Set(files.map((f) => f.replace(/\\/g, '/')).filter(Boolean)),
  ];
  const showcase = unique.some((f) => f.startsWith('showcase/'));

  if (event === 'push') {
    return { mode: 'full', showcase, tests: [] };
  }

  const componentDirs = new Set();
  for (const file of unique) {
    if (isNonePath(file)) continue;
    if (isSharedPath(file)) {
      return { mode: 'full', showcase, tests: [] };
    }
    const dir = componentDirOf(file);
    if (!dir) {
      return { mode: 'full', showcase, tests: [] };
    }
    componentDirs.add(dir);
  }

  if (componentDirs.size === 0) {
    return { mode: 'none', showcase, tests: [] };
  }

  const tests = [];
  for (const dir of [...componentDirs].sort()) {
    const found = testFilesIn(dir);
    if (found.length === 0) {
      return { mode: 'full', showcase, tests: [] };
    }
    tests.push(...found);
  }
  return { mode: 'targeted', showcase, tests };
};

const parseArgs = (argv) => {
  const files = [];
  let event = 'pull_request';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && arg.slice(2) === 'event') {
      event = argv[++i];
    } else if (arg !== '-' + '-') {
      files.push(arg);
    }
  }
  return { event, files };
};

const readStdin = async () => {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { event, files: argsFiles } = parseArgs(process.argv.slice(2));
  const stdin = await readStdin();
  const files = [
    ...argsFiles,
    ...stdin
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ];
  const result = detect(event, files);
  const tests = result.tests.join(' ');
  process.stdout.write(
    `mode=${result.mode}\nshowcase=${result.showcase}\ntests=${tests}\n`,
  );
}
