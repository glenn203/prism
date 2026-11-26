#!/usr/bin/env node
/**
 * Print WCAG contrast for default role pairs in light and dark, on the sRGB
 * fallback and the full Display P3 values. Exits 1 if any pair is below AA
 * (text 4.5:1, UI 3:1).
 *
 *   node scripts/contrast-report.mjs
 */
import { readFileSync } from 'node:fs';
import { contrast, contrastP3, oklchToHex } from './oklch.mjs';

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

// MessageBox info: text-muted on the 6% tint composited over color-bg.
const srgbOf = (str) => {
  const h = oklchToHex(str);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lumRgb = (c) => {
  const l = c.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const rgbRatio = (a, b) => {
  const [x, y] = [lumRgb(a), lumRgb(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const veil = (on, page, p) => {
  const [o, b] = [srgbOf(on), srgbOf(page)];
  return o.map((v, i) => v * p + b[i] * (1 - p));
};
const neu = (theme, k) =>
  theme === 'dark' && resolved.themes.dark[k]
    ? resolved.themes.dark[k].value
    : resolved.modes.default[k].value;

let veilCount = 0;
for (const theme of ['light', 'dark']) {
  veilCount += 1;
  const ink = theme === 'dark' ? 'neutral.0' : 'neutral.900';
  const r = rgbRatio(
    srgbOf(colorIn(theme, 'text-muted')),
    veil(neu(theme, ink), colorIn(theme, 'bg'), 0.06),
  );
  const ok = r >= 4.5;
  if (!ok) failed += 1;
  console.log(
    pad(theme, 6),
    pad('color-text-muted', 22),
    pad('tint over color-bg', 20),
    pad('4.5', 5),
    pad(r.toFixed(2), 6),
    pad(r.toFixed(2), 6),
    ok ? 'pass' : 'FAIL',
  );
}

if (failed) {
  console.error(`\n${failed} pair(s) below AA`);
  process.exit(1);
}
console.log(`\n${pairs.length * 2 + veilCount} pairs, all at or above AA`);
