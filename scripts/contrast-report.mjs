#!/usr/bin/env node
/**
 * Print WCAG contrast for default role pairs in light and dark, on the sRGB
 * fallback and the full Display P3 values. Exits 1 if any pair is below AA
 * (text 4.5:1, UI 3:1).
 *
 *   node scripts/contrast-report.mjs
 */
import { readFileSync } from 'node:fs';
import { contrast, contrastP3 } from './oklch.mjs';

const resolved = JSON.parse(
  readFileSync(
    new URL('../tokens/prism.tokens.resolved.json', import.meta.url),
    'utf8',
  ),
);

const colorIn = (theme, k) =>
  theme === 'dark' && resolved.themes.dark[`color.${k}`]
    ? resolved.themes.dark[`color.${k}`].value
    : resolved.modes.default[`color.${k}`].value;

const pairs = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text', 'surface-pressed', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['on-accent', 'accent-active', 4.5],
  ['accent-text', 'bg', 4.5],
  ['accent-text', 'surface', 4.5],
  ['accent-text', 'accent-surface', 4.5],
  ['error-text', 'bg', 4.5],
  ['error-text', 'surface', 4.5],
  ['on-solid', 'neutral', 4.5],
  ['accent', 'bg', 3],
  ['accent', 'surface-pressed', 3],
  ['border-strong', 'bg', 3],
  ['border-strong', 'surface', 3],
  ['focus-ring', 'bg', 3],
  ['focus-ring', 'surface', 3],
  ['focus-border', 'bg', 3],
  ['focus-border', 'surface', 3],
  ['error', 'bg', 3],
  ['neutral', 'bg', 3],
  ['neutral', 'surface-pressed', 3],
  ...['info', 'success', 'warning', 'danger'].flatMap((t) => [
    [`${t}-text`, `${t}-surface`, 4.5],
    [`${t}-text`, 'bg', 4.5],
    [`${t}-text`, 'surface', 4.5],
    ['on-solid', t, 4.5],
    [t, 'bg', 3],
    [t, 'surface-pressed', 3],
  ]),
];

const pad = (s, n) => String(s).padEnd(n);
let failed = 0;
console.log(
  pad('theme', 6),
  pad('foreground', 22),
  pad('background', 20),
  pad('min', 5),
  pad('sRGB', 6),
  pad('P3', 6),
  'status',
);
for (const theme of ['light', 'dark']) {
  for (const [fg, bg, min] of pairs) {
    const a = colorIn(theme, fg);
    const b = colorIn(theme, bg);
    const srgb = contrast(a, b);
    const p3 = contrastP3(a, b);
    const ok = Math.min(srgb, p3) >= min;
    if (!ok) failed += 1;
    console.log(
      pad(theme, 6),
      pad(`color-${fg}`, 22),
      pad(`color-${bg}`, 20),
      pad(min.toFixed(1), 5),
      pad(srgb.toFixed(2), 6),
      pad(p3.toFixed(2), 6),
      ok ? 'pass' : 'FAIL',
    );
  }
}

if (failed) {
  console.error(`\n${failed} pair(s) below AA`);
  process.exit(1);
}
console.log(`\n${pairs.length * 2} pairs, all at or above AA`);
