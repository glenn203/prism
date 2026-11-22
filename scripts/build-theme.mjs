/**
 * Assemble src/theme/theme.css from field chrome and per-component parts.
 *
 * Playwright inlines theme.css with addStyleTag({ path }), so @import in
 * that file would not load. The public export is also a single stylesheet.
 * This script concatenates marked sections in the historical cascade order
 * (button, field chrome, reduced-motion, remaining components, forced colours).
 *
 * Usage:
 *   node scripts/build-theme.mjs          write src/theme/theme.css
 *   node scripts/build-theme.mjs check   exit 1 if theme.css is stale
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const themeDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'theme',
);

const banner = `/*
 * Default look: maps token variables onto each element's ::part() hooks.
 * This is the everyday theme, not the whole library: you can skip it and
 * bring your own look, or swap it for a different one. Load this after
 * tokens.css (already included if you imported from 'prism/theme.css').
 * Complement with polish.css if you want the occasional flourish
 * (progress comet and the like).
 *
 * Assembled from theme-fields.css (field chrome) and theme-components.css
 * (per-component look). Run \`node scripts/build-theme.mjs\` after editing
 * a part; do not edit the assembled file by hand.
 */

/* ---------- Shared state layers (hover, press, selected) ----------
 * The mechanics live in src/internal/state-layer.ts (imported by each
 * component). Values come from --prism-state-hover / pressed / selected
 * in tokens.css. Opt out with data-prism-no-state-layer, or override
 * --_prism-state-overlay in a :host rule.
 */

`;

const SECTION_RE = /\/\* prism-theme-section: ([a-z0-9-]+) \*\//g;

function sectionsFrom(fileName) {
  const css = readFileSync(join(themeDir, fileName), 'utf8');
  const markers = [...css.matchAll(SECTION_RE)];
  if (markers.length === 0) {
    throw new Error(`${fileName} has no prism-theme-section markers`);
  }
  const map = {};
  for (let i = 0; i < markers.length; i += 1) {
    const name = markers[i][1];
    const start = markers[i].index + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : css.length;
    map[name] = css.slice(start, end).trim();
  }
  return map;
}

function requireSections(fileName, have, names) {
  for (const name of names) {
    if (!have[name])
      throw new Error(`${fileName} is missing section "${name}"`);
  }
}

function assemble() {
  const fields = sectionsFrom('theme-fields.css');
  const components = sectionsFrom('theme-components.css');
  requireSections('theme-fields.css', fields, [
    'fields',
    'fields-reduce',
    'fields-forced',
  ]);
  requireSections('theme-components.css', components, [
    'button',
    'button-reduce',
    'components',
    'components-forced',
  ]);

  // Historical order, so selector overlap does not change.
  const parts = [
    banner.trimEnd(),
    components.button,
    fields.fields,
    fields['fields-reduce'],
    components['button-reduce'],
    components.components,
    fields['fields-forced'],
    components['components-forced'],
  ];
  return `${parts.join('\n\n')}\n`;
}

const assembled = assemble();
const outPath = join(themeDir, 'theme.css');
const check = process.argv.includes('check');

if (check) {
  const current = readFileSync(outPath, 'utf8');
  if (current !== assembled) {
    console.error(
      'src/theme/theme.css is out of date. Run `node scripts/build-theme.mjs` and commit the result.',
    );
    process.exit(1);
  }
  process.exit(0);
}

writeFileSync(outPath, assembled);
console.log('wrote src/theme/theme.css');
