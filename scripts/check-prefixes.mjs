/**
 * Fails if a source file introduces an unprefixed data attribute, custom
 * property, or custom event. Allowed events: input, change, search, and
 * anything starting with prism-. Allowed custom properties: --prism-* and
 * --_* (including --_prism-*).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const roots = ['src', 'test', 'DESIGN.md', 'README.md', 'scripts'];
const skipDir = new Set([
  'dist',
  'node_modules',
  'storybook-static',
  'test-results',
]);
const skipFile = new Set(['custom-elements.json', 'check-prefixes.mjs']);
const exts = new Set(['.ts', '.css', '.md', '.mjs', '.js', '.mdx', '.html']);

const dataRe = /\bdata-(?!prism-)[a-z0-9-]+/g;
// CSS variables only: var(--x), '--x', `--x`, or a declaration `--x:`.
// Do not treat CLI flags such as `node --test` as custom properties.
const propRe =
  /(?:var\(|['"`])--(?!prism-|_)[A-Za-z][A-Za-z0-9-]*|^\s*--(?!prism-|_)[A-Za-z][A-Za-z0-9-]*\s*:/gm;
const eventRe = /new (?:Custom)?Event\(\s*['"]([^'"]+)['"]/g;
const allowedEvents = new Set(['input', 'change', 'search']);

function walk(path, out) {
  const st = statSync(path);
  if (st.isDirectory()) {
    const name = path.split('/').pop();
    if (skipDir.has(name)) return;
    for (const entry of readdirSync(path)) walk(join(path, entry), out);
    return;
  }
  if (skipFile.has(path.split('/').pop())) return;
  if (!exts.has(extname(path))) return;
  out.push(path);
}

const files = [];
for (const root of roots) walk(root, files);

const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const [i, line] of text.split('\n').entries()) {
    for (const match of line.matchAll(dataRe)) {
      problems.push(`${file}:${i + 1}: unprefixed data attribute ${match[0]}`);
    }
    for (const match of line.matchAll(propRe)) {
      problems.push(`${file}:${i + 1}: unprefixed custom property ${match[0]}`);
    }
  }
  for (const match of text.matchAll(eventRe)) {
    const name = match[1];
    if (allowedEvents.has(name) || name.startsWith('prism-')) continue;
    const line = text.slice(0, match.index).split('\n').length;
    problems.push(`${file}:${line}: unprefixed event '${name}'`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check-prefixes: ${files.length} files ok`);
