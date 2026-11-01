// Node test: run with `node --test test/tokens.test.mjs`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resolved = JSON.parse(
  readFileSync(
    new URL('../tokens/prism.tokens.resolved.json', import.meta.url),
    'utf8',
  ),
);
// Off the 4px grid by design: hairlines, the focus ring, and the odd radius ramp.
const OFF_GRID = new Set([
  'border.width',
  'focus.ring-width',
  'focus.ring-offset',
  'focus.ring-blur',
  'focus.halo-width',
  'progress.head-size', // a highlight radius, not layout
]);

for (const [mode, tokens] of Object.entries(resolved.modes)) {
  test(`${mode}: every dimension is a multiple of 4px`, () => {
    for (const [key, t] of Object.entries(tokens)) {
      if (t.type !== 'dimension' || OFF_GRID.has(key)) continue;
      if (key.startsWith('radius.')) continue;
      if (key.startsWith('font.size') || key.endsWith('font-size')) continue; // font sizes are 2px-steps by design
      assert.equal(t.value % 4, 0, `${key} = ${t.value}px in ${mode}`);
    }
  });
  test(`${mode}: small controls meet the 24px WCAG 2.2 target size`, () => {
    assert.ok(tokens['control.height.sm'].value >= 24);
  });
}

test('control.height.md is 24/36/48 across compact/default/comfortable', () => {
  assert.deepEqual(
    ['compact', 'default', 'comfortable'].map(
      (m) => resolved.modes[m]['control.height.md'].value,
    ),
    [24, 36, 48],
  );
});

test('control.height.sm is 24/32/40 across compact/default/comfortable', () => {
  assert.deepEqual(
    ['compact', 'default', 'comfortable'].map(
      (m) => resolved.modes[m]['control.height.sm'].value,
    ),
    [24, 32, 40],
  );
});

// ---------- Color ----------
const { contrast, contrastP3, inSrgb, inP3, toLinearRgb } =
  await import('../scripts/oklch.mjs');
const THEMES = ['light', 'dark'];
const tokIn = (theme, k) =>
  theme === 'dark' && resolved.themes.dark[k]
    ? resolved.themes.dark[k].value
    : resolved.modes.default[k].value;
const colorIn = (theme, k) => tokIn(theme, `color.${k}`);
// [fg, bg, min ratio]. Text 4.5:1; borders, focus and solid fills 3:1.
const pairs = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text', 'surface-pressed', 4.5], // avatar initials
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['on-accent', 'accent-active', 4.5],
  ['accent-text', 'bg', 4.5],
  ['accent-text', 'surface', 4.5],
  ['accent-text', 'accent-surface', 4.5],
  ['accent', 'bg', 3],
  ['accent', 'surface-pressed', 3], // progress fill on its track
  ['error-text', 'bg', 4.5],
  ['border-strong', 'bg', 3],
  ['border-strong', 'surface', 3], // interactive card edge on a surface page
  ['focus-ring', 'bg', 3],
  ['focus-ring', 'surface', 3],
  ['error', 'bg', 3],
  ['neutral', 'bg', 3],
  ['neutral', 'surface-pressed', 3],
  ['on-solid', 'neutral', 4.5],
  ...['info', 'success', 'warning', 'danger'].flatMap((t) => [
    [`${t}-text`, `${t}-surface`, 4.5],
    [`${t}-text`, 'bg', 4.5],
    [`${t}-text`, 'surface', 4.5],
    ['on-solid', t, 4.5],
    [t, 'bg', 3],
    [t, 'surface-pressed', 3],
  ]),
];
for (const theme of THEMES)
  for (const [fg, bg, min] of pairs) {
    test(`contrast [${theme}]: color-${fg} on color-${bg} >= ${min}:1 (sRGB and P3)`, () => {
      const [a, b] = [colorIn(theme, fg), colorIn(theme, bg)];
      const srgb = contrast(a, b);
      const p3 = contrastP3(a, b);
      assert.ok(srgb >= min, `sRGB ${srgb.toFixed(2)}:1`);
      assert.ok(p3 >= min, `P3 ${p3.toFixed(2)}:1`);
    });
  }

test('role pairs: lowest text and non-text contrast (report)', () => {
  for (const [what, pick] of [
    ['text 4.5', (m) => m === 4.5],
    ['non-text 3', (m) => m === 3],
  ]) {
    let low = { r: 99 };
    for (const theme of THEMES)
      for (const [fg, bg, min] of pairs) {
        if (!pick(min)) continue;
        const [a, b] = [colorIn(theme, fg), colorIn(theme, bg)];
        const r = Math.min(contrast(a, b), contrastP3(a, b));
        if (r < low.r) low = { r, theme, fg, bg };
      }
    console.log(
      `  [lowest ${what}] ${low.theme} color-${low.fg} on color-${low.bg}: ${low.r.toFixed(2)}`,
    );
  }
});

test('every color is inside Display P3 and has an sRGB hex fallback; colours outside sRGB are flagged p3', () => {
  const all = [
    ...Object.entries(resolved.modes.default),
    ...Object.entries(resolved.themes.dark),
  ];
  for (const [key, t] of all) {
    if (t.type !== 'color') continue;
    assert.ok(inP3(t.value), `${key} ${t.value} is out of Display P3`);
    assert.match(t.hex, /^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    assert.equal(t.gamut === 'p3', !inSrgb(t.value), `${key} gamut flag`);
  }
});

test('the palette has a real Display P3 range: at least 12 colours sit outside sRGB', () => {
  const vivid = Object.values(resolved.modes.default).filter(
    (t) => t.gamut === 'p3',
  );
  assert.ok(vivid.length >= 12, `${vivid.length} P3 colours`);
});

test('tokens.css: P3 colours are gated by color-gamut, with a mapped sRGB base and a hex tier', () => {
  const css = readFileSync(
    new URL('../src/tokens/tokens.css', import.meta.url),
    'utf8',
  );
  const at = css.indexOf('@media (color-gamut: p3)');
  assert.ok(at > 0, 'p3 media block exists');
  const p3 = css.slice(at, css.indexOf('\n}\n', at));
  const base = css.slice(0, at);
  const vivid = Object.entries(resolved.modes.default).filter(
    ([key, t]) => t.gamut === 'p3' && /^color\.[a-z]+\.\d+$/.test(key),
  );
  assert.ok(vivid.length >= 12);
  for (const [key, t] of vivid) {
    const name = t.cssVar;
    assert.ok(p3.includes(`${name}: ${t.value};`), `${name} full chroma in p3`);
    const m = new RegExp(`${name}: (oklch\\([^)]*\\));`).exec(base);
    assert.ok(m && inSrgb(m[1]), `${key} base ${m?.[1]} must be inside sRGB`);
    const hex = new RegExp(
      `@supports not \\(color: oklch\\(0 0 0\\)\\) \\{[^]*?${name}: ${t.hex};`,
    );
    assert.match(css, hex, `${name} hex fallback`);
  }
});

test('dark theme: scopes exist and re-declare roles, elevation and halo', () => {
  const css = readFileSync(
    new URL('../src/tokens/tokens.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /\[data-prism-theme='dark'\] \{\s*color-scheme: dark;/);
  assert.match(
    css,
    /@media \(prefers-color-scheme: dark\) \{\s*\[data-prism-theme='auto'\] \{\s*color-scheme: dark;/,
  );
  const dark = css.slice(css.indexOf(`[data-prism-theme='dark'] {`));
  const scope = dark.slice(0, dark.indexOf('\n}\n'));
  for (const k of [
    'color-bg',
    'color-text',
    'color-accent',
    'color-focus-halo',
    'focus-halo',
    'elevation-default',
    'elevation-hover',
    'gradient-mist',
  ])
    assert.match(scope, new RegExp(`--prism-${k}:`), `${k} in dark scope`);
  assert.doesNotMatch(
    css.slice(0, css.indexOf(`[data-prism-theme='dark'] {`)),
    /prefers-color-scheme/,
    'dark never applies unless a scope opts in',
  );
});

test('gradients: spectrum, refract and mist, with a non-interpolated base', () => {
  const css = readFileSync(
    new URL('../src/tokens/tokens.css', import.meta.url),
    'utf8',
  );
  for (const g of ['spectrum', 'refract', 'mist']) {
    assert.match(
      css,
      new RegExp(`--prism-gradient-${g}: linear-gradient\\(\\d+deg,`),
    );
    assert.match(
      css,
      new RegExp(`--prism-gradient-${g}: linear-gradient\\(in oklch \\d+deg,`),
    );
  }
});

test('mist gradient: text on every stop >= 4.5:1 in both themes', () => {
  for (const theme of THEMES) {
    const stops = resolved[theme === 'dark' ? 'themes' : 'modes'];
    const g = (theme === 'dark' ? stops.dark : stops.default)['gradient.mist'];
    const found = [...g.value.matchAll(/oklch\([^)]*\)/g)].map((m) => m[0]);
    assert.equal(found.length, 4);
    for (const stop of found)
      for (const fg of ['text', 'text-muted'])
        assert.ok(
          contrast(colorIn(theme, fg), stop) >= 4.5 &&
            contrastP3(colorIn(theme, fg), stop) >= 4.5,
          `${theme} ${fg} on ${stop}`,
        );
  }
});

test('radius ramp is odd px (plus none and full)', () => {
  for (const [key, t] of Object.entries(resolved.modes.default)) {
    if (
      !key.startsWith('radius.') ||
      key === 'radius.none' ||
      key === 'radius.full'
    )
      continue;
    assert.equal(t.value % 2, 1, `${key} = ${t.value}`);
    assert.equal(key, `radius.${t.value}`, 'radius-N must equal N px');
  }
});

test('the ramps are the neutral, the spectrum and red', () => {
  const ramps = new Set(
    Object.keys(resolved.modes.default)
      .filter((k) => /^color\.[a-z]+\.\d+$/.test(k))
      .map((k) => k.split('.')[1]),
  );
  assert.deepEqual([...ramps].sort(), [
    'amber',
    'blue',
    'cyan',
    'green',
    'magenta',
    'red',
    'slate',
    'violet',
  ]);
});

test('focus ring: 1px gap + 2px ring + 1px halo; reach fits the space-1 label gap', () => {
  const d = resolved.modes.default;
  assert.equal(d['focus.ring-offset'].value, 1);
  assert.equal(d['focus.ring-width'].value, 2);
  assert.equal(d['focus.halo-width'].value, 1);
  const extent =
    d['focus.ring-offset'].value +
    d['focus.ring-width'].value +
    d['focus.halo-width'].value;
  assert.ok(d['space.1'].value >= extent, `extent ${extent}px`);
  assert.ok(d['space.2'].value > extent);
});

test('elevation: three shared levels, slate-based, urgent tinted from error red', () => {
  const t = resolved.modes.default;
  for (const level of ['default', 'hover', 'urgent']) {
    const e = t[`elevation.${level}`];
    assert.ok(e, `elevation.${level} exists`);
    assert.equal(e.type, 'shadow');
    assert.equal(e.cssVar, `--prism-elevation-${level}`);
    assert.match(e.value, /oklch\(/);
  }
  assert.match(t['elevation.default'].value, / 260 \//); // slate hue
  assert.match(t['elevation.hover'].value, / 260 \//);
  assert.match(t['elevation.urgent'].value, / 12 \//); // error rose hue
  const css = readFileSync(
    new URL('../src/tokens/tokens.css', import.meta.url),
    'utf8',
  );
  for (const level of ['default', 'hover', 'urgent'])
    assert.ok(css.includes(`--prism-elevation-${level}:`));
});

test('components consume elevation tokens, no hard-coded shadows', () => {
  for (const f of ['../src/select/select.ts', '../src/option/option.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/box-shadow/.test(src), `${f} must not set box-shadow`);
  }
  const theme = readFileSync(
    new URL('../src/theme/theme.css', import.meta.url),
    'utf8',
  );
  const block = theme.slice(theme.indexOf('/* ---------- Select'));
  assert.ok(!/box-shadow:[^;]*inset/.test(block), 'no inside-border focus');
  assert.ok(
    !/box-shadow:\s*var\(--prism-elevation-urgent/.test(theme),
    'elevation-urgent is reserved, unused',
  );
  // elevation-hover is reserved for the raised card at rest (card spec).
  const cardAt = theme.indexOf('/* ---------- Card');
  assert.ok(
    !/var\(--prism-elevation-hover/.test(theme.slice(0, cardAt)),
    'elevation-hover is reserved for the raised card, nowhere else',
  );
  assert.ok(
    [...theme.slice(cardAt).matchAll(/var\(--prism-elevation-hover/g)]
      .length === 1,
    'only prism-card[raised] uses elevation-hover',
  );
  for (const m of block.matchAll(/box-shadow:\s*([^;]+);/g))
    assert.ok(
      /var\(--prism-elevation-(default|hover|track)|var\(--_(elev|sh-sel|sh-focus)|--prism-focus-ring|--prism-color-focus-ring|^4px 0 10px -2px\s+color-mix\(\s*in oklch,\s*var\(--_tone-high-bg\)\s+var\(--prism-progress-glow-alpha|^none$/.test(
        m[1].trim(),
      ),
      `unexpected shadow: ${m[1]}`,
    );
});

test('error box: lighter fill (10% red over white) keeps status text >= 4.5:1', () => {
  const t = resolved.modes.default;
  assert.match(t['color.error-surface'].value, /\/ 0\.08\)$/);
  const rgb = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
    return c.map((v) => v * a + 255 * (1 - a));
  };
  const lum = (c) => {
    const l = c.map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  };
  const a = lum(rgb(t['color.error-surface'].hex));
  const b = lum(rgb(t['color.on-error-surface'].hex));
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 4.5, `ratio ${ratio}`);
});

test('focus ring total reach (offset + ring + halo) is at most 4px', () => {
  const t = resolved.modes.default;
  const reach =
    t['focus.ring-offset'].value +
    t['focus.ring-width'].value +
    t['focus.halo-width'].value;
  assert.ok(reach <= 4, `reach ${reach}px`);
});

// ---------- Motion (token names provisional) ----------
const parseLinear = (css) => {
  const m = /^linear\(([^()]*)\)$/.exec(css);
  assert.ok(m, `not a linear(): ${css.slice(0, 40)}`);
  return m[1].split(',').map((s) => {
    const n = Number(s.trim());
    assert.ok(Number.isFinite(n), `bad stop "${s}"`);
    return n;
  });
};
test('durations are 120 / 200 / 320ms', () => {
  const d = resolved.modes.default;
  assert.deepEqual(
    ['fast', 'default', 'slow'].map((k) => d[`duration.${k}`].value),
    ['120ms', '200ms', '320ms'],
  );
});
test('ease.standard is a cubic-bezier', () => {
  assert.deepEqual(
    resolved.modes.default['ease.standard'].value,
    [0.2, 0, 0, 1],
  );
});
for (const name of ['spring', 'spring-bouncy']) {
  test(`ease.${name}: valid linear(), starts at 0, ends at 1, has a cubic-bezier fallback`, () => {
    const t = resolved.modes.default[`ease.${name}`];
    const stops = parseLinear(t.value);
    assert.ok(stops.length >= 10);
    assert.equal(stops[0], 0);
    assert.equal(stops.at(-1), 1);
    assert.match(t.fallback, /^cubic-bezier\([^)]+\)$/);
  });
}
test('ease.spring is critically damped: monotonic, never overshoots', () => {
  const t = resolved.modes.default['ease.spring'];
  const s = parseLinear(t.value);
  for (let i = 1; i < s.length; i++)
    assert.ok(s[i] >= s[i - 1], `dip at stop ${i}`);
  assert.ok(Math.max(...s) <= 1);
  assert.ok(t.spring.dampingRatio >= 1);
});
test('ease.spring-bouncy overshoots 3–5% and settles back', () => {
  const t = resolved.modes.default['ease.spring-bouncy'];
  const peak = Math.max(...parseLinear(t.value));
  assert.ok(peak >= 1.03 && peak <= 1.05, `peak ${peak}`);
  assert.ok(t.spring.overshoot >= 0.03 && t.spring.overshoot <= 0.05);
});
test('spring settle times match their duration tokens (±10%)', () => {
  const d = resolved.modes.default;
  for (const [k, dur] of [
    ['spring', 'default'],
    ['spring-bouncy', 'slow'],
  ]) {
    const want = parseFloat(d[`duration.${dur}`].value);
    const got = d[`ease.${k}`].spring.settleMs;
    assert.ok(
      Math.abs(got - want) / want <= 0.1,
      `${k}: ${got}ms vs ${want}ms`,
    );
  }
});
test('tokens.css: springs ship linear() with an @supports cubic-bezier fallback', () => {
  const css = readFileSync(
    new URL('../src/tokens/tokens.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /--prism-ease-spring: linear\(/);
  assert.match(
    css,
    /@supports not \(animation-timing-function: linear\(0, 1\)\)[\s\S]*--prism-ease-spring: cubic-bezier/,
  );
});
test('theme: reduced motion zeroes durations and flattens springs', () => {
  const css = readFileSync(
    new URL('../src/theme/theme.css', import.meta.url),
    'utf8',
  );
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const k of ['fast', 'default', 'slow'])
    assert.match(rm, new RegExp(`--prism-duration-${k}: 0\\.01ms`));
  assert.match(rm, /--prism-ease-spring: linear;/);
  assert.match(rm, /--prism-ease-spring-bouncy: linear;/);
  // No spring on colour, border or the error box.
  assert.doesNotMatch(
    css,
    /(background-color|border-color|color) var\([^)]*\) var\(--prism-ease-spring/,
  );
  assert.doesNotMatch(css, /prism-error-in[^;]*spring/);
});

// ---------- Semantic layer + shared state layer ----------
import { readFileSync as rf } from 'node:fs';
const { parseOklch, oklchToHex } = await import('../scripts/oklch.mjs');
let THEME = 'light'; // the theme the tests being defined read their tokens from
const tok = (k) => tokIn(THEME, k);
const srgb = (str) => {
  const h = oklchToHex(str);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lumRgb = (c) => {
  const l = c.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const ratio = (a, b) => {
  const [x, y] = [lumRgb(a), lumRgb(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** color-mix(in oklch, a, b p%) for opaque a/b (shorter hue arc). */
const mixOklch = (a, b, p) => {
  const [l1, c1, h1] = parseOklch(a);
  const [l2, c2, h2] = parseOklch(b);
  const ha = c1 === 0 ? h2 : h1;
  const hb = c2 === 0 ? h1 : h2;
  let d = hb - ha;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const h = (ha + d * p + 360) % 360;
  return `oklch(${l1 + (l2 - l1) * p} ${c1 + (c2 - c1) * p} ${h})`;
};
/** Transparent surface: on-colour at p alpha composited over the page bg. */
const veil = (on, page, p) => {
  const [o, b] = [srgb(on), srgb(page)];
  return o.map((v, i) => v * p + b[i] * (1 - p));
};
const pct = (k) => parseFloat(tok(`state.${k}`)) / 100;
const STATES = {
  hover: pct('hover'),
  pressed: pct('pressed'),
  selected: pct('selected'),
  'selected+hover': pct('selected-hover'),
};
export const STATE_CONTRAST = [];

test('state tokens: hover 6%, pressed 12%, selected 11%, selected+hover 15%', () => {
  assert.equal(tok('state.hover'), '6%');
  assert.equal(tok('state.pressed'), '12%');
  assert.equal(tok('state.selected'), '11%');
  assert.equal(tok('state.selected-hover'), '15%');
  assert.ok(
    pct('hover') < pct('selected') && pct('selected') < pct('selected-hover'),
    'each state is a step heavier than the last',
  );
});

// ---- Display P3 pass ----
// The same overlay maths on wide-gamut colours. Browsers mix in extended sRGB
// (channels may leave 0..1), so the fill is blended in gamma-encoded extended
// coordinates and its luminance read back from the linear values, unclamped.
const encX = (x) =>
  Math.sign(x) *
  (Math.abs(x) <= 0.0031308
    ? 12.92 * Math.abs(x)
    : 1.055 * Math.abs(x) ** (1 / 2.4) - 0.055);
const decX = (v) =>
  Math.sign(v) *
  (Math.abs(v) <= 0.04045
    ? Math.abs(v) / 12.92
    : ((Math.abs(v) + 0.055) / 1.055) ** 2.4);
const extOf = (str) => toLinearRgb(parseOklch(str)).map(encX);
const veilX = (on, base, p) =>
  extOf(on).map((v, i) => v * p + base[i] * (1 - p));
const lumX = (ext) => {
  const [r, g, b] = ext.map(decX);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratioX = (a, b) => {
  const [x, y] = [lumX(a), lumX(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const SURFACES = [
  ['button (solid)', 'color.accent', 'color.on-accent', 'oklch'],
  ['option', 'color.bg', 'color.text', 'oklch'],
  ['outline button', null, 'color.text', 'veil'],
  ['icon button', null, 'color.text', 'veil'],
];
for (const theme of THEMES)
  for (const [name, bgKey, onKey, mode] of SURFACES)
    for (const [state, p] of Object.entries(STATES))
      test(`state contrast [${theme}]: ${name} ${state} — text on fill >= 4.5:1`, () => {
        THEME = theme;
        const on = tok(onKey);
        const fill =
          mode === 'oklch'
            ? srgb(mixOklch(tok(bgKey), on, p))
            : veil(on, tok('color.bg'), p);
        const r = ratio(srgb(on), fill);
        const fillX =
          mode === 'oklch'
            ? extOf(mixOklch(tok(bgKey), on, p))
            : veilX(on, extOf(tok('color.bg')), p);
        const rx = ratioX(extOf(on), fillX);
        THEME = 'light';
        console.log(
          `  [${theme}] ${name} ${state}: sRGB ${r.toFixed(2)}:1, P3 ${rx.toFixed(2)}:1`,
        );
        assert.ok(r >= 4.5, `sRGB ${r.toFixed(2)}:1`);
        assert.ok(rx >= 4.5, `P3 ${rx.toFixed(2)}:1`);
      });

for (const theme of THEMES)
  test(`outline button [${theme}]: border >= 3:1 and label >= 4.5:1 on bg`, () => {
    const bg = srgb(tokIn(theme, 'color.bg'));
    const border = ratio(srgb(tokIn(theme, 'color.border-strong')), bg);
    const label = ratio(srgb(tokIn(theme, 'color.text')), bg);
    console.log(
      `  [${theme}] outline border ${border.toFixed(2)}:1, label ${label.toFixed(2)}:1`,
    );
    assert.ok(border >= 3);
    assert.ok(label >= 4.5);
  });

test('on-error-surface pairs with error-surface; error-status-text is its alias', () => {
  assert.equal(tok('color.error-status-text'), tok('color.on-error-surface'));
  assert.equal(
    tok('color.error-surface'),
    tok('color.red.500').replace(/\)$/, ' / 0.08)'),
  );
  assert.equal(tok('color.on-error-surface'), 'oklch(0.368 0.147 12)');
  const r = ratio(
    srgb(tok('color.on-error-surface')),
    veil(tok('color.red.500'), tok('color.bg'), 0.08),
  );
  assert.ok(r >= 4.5, `${r}`);
});

test('elevation and focus halo are built from roles with exact former values', () => {
  assert.equal(tok('color.shadow'), tok('color.slate.950'));
  assert.equal(tok('color.shadow-urgent'), tok('color.red.600'));
  assert.equal(
    tok('focus.halo'),
    tok('color.focus-ring').replace(/\)$/, ' / 0.12)'),
    'halo = the focus ring at 12%',
  );
  assert.equal(
    tok('elevation.default'),
    '0 1px 2px oklch(0.129 0.03 260 / 0.06), 0 4px 12px -2px oklch(0.129 0.03 260 / 0.12)',
  );
  const css = rf(new URL('../src/tokens/tokens.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /--prism-elevation-default: 0 1px 2px color-mix\(in oklch, var\(--prism-color-shadow\)/,
  );
  assert.match(
    css,
    /@supports not \(color: color-mix\(in oklch, red, blue\)\) \{[\s\S]*--prism-elevation-default: 0 1px 2px oklch\(/,
  );
});

test('theme + component styles: no raw palette refs, no colour literals', () => {
  const files = [
    '../src/theme/theme.css',
    ...[
      'button/button',
      'option/option',
      'select/select',
      'text-input/text-input',
      'password-input/password-input',
      'search-input/search-input',
      'otp-input/otp-input',
      'text-area/text-area',
      'internal/text-control',
      'internal/state-layer',
      'internal/field-parts',
      'internal/control-styles',
      'internal/icons',
    ].map((f) => `../src/${f}.ts`),
  ];
  for (const f of files) {
    const src = rf(new URL(f, import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    assert.doesNotMatch(
      src,
      /--prism-color-(slate|red)-\d/,
      `${f}: raw palette ref`,
    );
    assert.doesNotMatch(
      src,
      /\b(oklch|oklab|rgba?|hsla?|lab|lch)\(/,
      `${f}: colour literal`,
    );
    const hexes = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(
      hexes.filter((h) => h !== '#000'),
      [],
      `${f}: hex literal`,
    );
  }
});

// ---------- Full contrast matrix (state layer) ----------
// Every fg/bg pair on every state fill. Text >= 4.5:1, borders/icons >= 3:1.
// Disabled is exempt per WCAG 1.4.3/1.4.11 but its numbers are reported.
const MATRIX_STATES = { rest: 0, ...STATES };
/** sRGB (0..1, gamma) -> oklch() string (Ottosson). */
const toOklch = (rgb) => {
  const [r, g, b] = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return `oklch(${L} ${Math.hypot(A, B)} ${((Math.atan2(B, A) * 180) / Math.PI + 360) % 360})`;
};
// bgKey may be [roleA, roleB, pct, space?] for an opaque color-mix() base.
// 'srgb' = roleB at pct alpha composited over roleA (what a veil renders).
const baseOf = (bgKey) =>
  !Array.isArray(bgKey)
    ? tok(bgKey)
    : bgKey[3] === 'srgb'
      ? toOklch(veil(tok(bgKey[1]), tok(bgKey[0]), bgKey[2]))
      : mixOklch(tok(bgKey[0]), tok(bgKey[1]), bgKey[2]);
// State layer = alpha overlay: the on-colour at p alpha composited (srgb)
// over the opaque resting fill, or over color-bg for transparent surfaces.
const fillOf = (bgKey, onKey, p) =>
  veil(tok(onKey), bgKey ? baseOf(bgKey) : tok('color.bg'), p);
// The same fill on a Display P3 screen (extended sRGB channels).
const baseOfX = (bgKey) =>
  !Array.isArray(bgKey)
    ? extOf(tok(bgKey))
    : bgKey[3] === 'srgb'
      ? veilX(tok(bgKey[1]), extOf(tok(bgKey[0])), bgKey[2])
      : extOf(mixOklch(tok(bgKey[0]), tok(bgKey[1]), bgKey[2]));
const fillOfX = (bgKey, onKey, p) =>
  veilX(tok(onKey), bgKey ? baseOfX(bgKey) : extOf(tok('color.bg')), p);
// [surface, bg role (null = transparent on color-bg), on role, [fg role, kind]]
const MATRIX = [
  ['button', 'color.accent', 'color.on-accent', [['color.on-accent', 'text']]],
  [
    'secondary',
    ['color.bg', 'color.accent', 0.08],
    'color.accent-text',
    [['color.accent-text', 'text']],
  ],
  [
    'ghost',
    null,
    'color.text',
    [
      ['color.text', 'text'],
      ['color.text-muted', 'text'],
    ],
  ],
  [
    'destructive',
    ['color.bg', 'color.error-surface-base', 0.08, 'srgb'],
    'color.on-error-surface',
    [['color.on-error-surface', 'text']],
  ],
  [
    'outline',
    null,
    'color.text',
    [
      ['color.text', 'text'],
      ['color.text-muted', 'text'],
      ['color.border-strong', 'border'],
    ],
  ],
  [
    'option',
    'color.bg',
    'color.text',
    [
      ['color.text', 'text'],
      ['color.text-muted', 'text'],
      ['color.text', 'icon'], // check mark
    ],
  ],
  // Switch. Off: surface track, a border-strong edge and a muted thumb. On: the
  // accent wash with an on-accent thumb. The overlay is the on-colour at the
  // state's alpha over the fill, under the thumb.
  [
    'switch (off)',
    'color.surface',
    'color.text',
    [
      ['color.border-strong', 'border'], // track edge
      ['color.text-muted', 'icon'], // thumb on the track
    ],
  ],
  [
    'switch (on)',
    'color.accent',
    'color.on-accent',
    [['color.on-accent', 'icon']], // thumb on the wash
  ],
  [
    'icon button',
    null,
    'color.text',
    [
      ['color.text-muted', 'icon'], // resting icon colour
      ['color.text', 'icon'], // hover icon colour
    ],
  ],
  // Card family (M1). Cards are not interactive yet, so these rows also stand
  // in for the controls placed on them: the surface is the base the overlay of
  // a ghost button or icon button composites over.
  [
    'card (bordered, raised)',
    'color.bg',
    'color.text',
    [
      ['color.text', 'text'], // title, content
      ['color.text-muted', 'text'], // description, footer meta
      ['color.text-muted', 'icon'], // icon button resting icon
    ],
  ],
  [
    'card (borderless)',
    'color.surface',
    'color.text',
    [
      ['color.text', 'text'],
      ['color.text-muted', 'text'],
      ['color.text-muted', 'icon'],
    ],
  ],
  // M2: clickable, choice and collection cards. The edge (strong border) and
  // the selected ring (accent) are non-text and must hold 3:1 against the card
  // fill in every state, and the text on the overlay 4.5:1.
  [
    'card (clickable, selectable)',
    'color.bg',
    'color.text',
    [
      ['color.text', 'text'], // title
      ['color.text-muted', 'text'], // description, meta
      ['color.border-strong', 'border'], // the visible edge (1.4.11)
      ['color.accent', 'border'], // selected ring
      ['color.text', 'icon'], // check mark / radio dot
    ],
  ],
  // M3: widget (metric number, label, range line and its "Overridden" flag),
  // the collapsible toggle (title text, chevron over the hover and press tint),
  // and the card list (selected count, pager text, page-size select edge).
  // Skeleton lines are decorative (aria-hidden) and carry no information.
  [
    'widget (metric, range)',
    'color.bg',
    'color.text',
    [
      ['color.text', 'text'], // metric number, "Overridden" flag
      ['color.text-muted', 'text'], // metric label, range line, "Updated"
      ['color.border-strong', 'border'], // the flag's edge
    ],
  ],
  [
    'collapsible toggle',
    'color.bg',
    'color.text',
    [
      ['color.text', 'text'], // title
      ['color.text-muted', 'icon'], // chevron
    ],
  ],
  [
    'card list (count, pager)',
    'color.bg',
    'color.text',
    [
      ['color.text', 'text'], // "3 selected", page status
      ['color.text-muted', 'text'], // "Per page"
      ['color.border-strong', 'border'], // page-size select edge
    ],
  ],
  // M4: the drag handle (grip icon, tinted on hover and press), the drop line
  // and its dot (accent), and the drag copy (text, strong edge). The original
  // dims to 40% while it is dragged; that transient state is not measured.
  [
    'reorder (handle, drop line, copy)',
    'color.bg',
    'color.text',
    [
      ['color.text-muted', 'icon'], // grip icon
      ['color.text', 'icon'], // grip icon on hover and focus
      ['color.accent', 'border'], // drop line and dot
      ['color.border-strong', 'border'], // the copy's edge
      ['color.text', 'text'], // copy title
      ['color.text-muted', 'text'], // copy description and meta
    ],
  ],
  ['menu item', 'color.bg', 'color.text', [['color.text', 'text']]],
];
export const MATRIX_RESULTS = [];
for (const theme of THEMES) {
  THEME = theme;
  for (const [surface, bgKey, onKey, pairs] of MATRIX)
    for (const [state, p] of Object.entries(MATRIX_STATES))
      for (const [fg, kind] of pairs) {
        const min = kind === 'text' ? 4.5 : 3;
        const r = ratio(srgb(tok(fg)), fillOf(bgKey, onKey, p));
        const rx = ratioX(extOf(tok(fg)), fillOfX(bgKey, onKey, p));
        MATRIX_RESULTS.push({ theme, surface, state, fg, kind, r, rx });
        test(`matrix [${theme}]: ${surface} ${state} — ${fg.slice(6)} (${kind}) >= ${min}:1 [sRGB ${r.toFixed(2)}, P3 ${rx.toFixed(2)}]`, () => {
          assert.ok(
            r >= min,
            `${theme} ${surface} ${state} ${fg}: sRGB ${r.toFixed(2)}:1`,
          );
          assert.ok(
            rx >= min,
            `${theme} ${surface} ${state} ${fg}: P3 ${rx.toFixed(2)}:1`,
          );
        });
      }
}
THEME = 'light';

test('matrix report: disabled (exempt) numbers', () => {
  const surf = srgb(tok('color.surface'));
  const rows = [
    [
      'button disabled: text-muted on surface',
      ratio(srgb(tok('color.text-muted')), surf),
    ],
    [
      'button disabled: border on bg',
      ratio(srgb(tok('color.border')), srgb(tok('color.bg'))),
    ],
    [
      'destructive rest vs error box over bg: max sRGB channel diff (0-255)',
      Math.max(
        ...srgb(
          baseOf(['color.bg', 'color.error-surface-base', 0.08, 'srgb']),
        ).map(
          (v, i) =>
            Math.abs(
              v -
                veil(tok('color.error-surface-base'), tok('color.bg'), 0.08)[i],
            ) * 255,
        ),
      ),
    ],
    [
      'ghost disabled: text-muted on bg',
      ratio(srgb(tok('color.text-muted')), srgb(tok('color.bg'))),
    ],
    [
      'option disabled: text-muted on bg',
      ratio(srgb(tok('color.text-muted')), srgb(tok('color.bg'))),
    ],
  ];
  for (const [k, r] of rows) console.log(`  [exempt] ${k}: ${r.toFixed(2)}:1`);
});

test('resting focus ring has no blur (no sub-pixel fringe)', () => {
  const theme = readFileSync(
    new URL('../src/theme/theme.css', import.meta.url),
    'utf8',
  );
  assert.ok(
    !/0 0 var\(--prism-focus-ring-blur\) 0 var\(--prism-color-focus-ring\)/.test(
      theme,
    ),
    'resting ring layer must be 0 0 0 0',
  );
});

// ---------- Tone palette (Tag, Badge, Progress) ----------
// Every tone reads colour roles (so it follows the theme). The light hex
// fallback inside each var() must equal the role's light value. All pairs are
// measured in both themes, on sRGB and P3 screens.
{
  const src = readFileSync(
    new URL('../src/internal/tones.ts', import.meta.url),
    'utf8',
  );
  const block = src.slice(
    src.indexOf('/* TONES-START */'),
    src.indexOf('/* TONES-END */'),
  );
  const refs = {}; // tone -> prop -> role name
  const fallbacks = {}; // tone -> prop -> hex
  const read = (tone, chunk) => {
    refs[tone] = { ...refs.neutral };
    fallbacks[tone] = { ...fallbacks.neutral };
    for (const m of chunk.matchAll(
      /--_tone-([a-z-]+): var\(--prism-color-([a-z-]+), (#[0-9a-f]{6})\);/g,
    )) {
      refs[tone][m[1]] = m[2];
      fallbacks[tone][m[1]] = m[3];
    }
  };
  const idx = (t) => block.indexOf(`:host([\${a}='${t}'])`);
  refs.neutral = {};
  fallbacks.neutral = {};
  read('neutral', block.slice(0, idx('accent')));
  for (const t of ['accent', 'danger', 'info', 'success', 'warning'])
    read(t, block.slice(idx(t)).split(/\n\s*\}/)[0]);
  for (const theme of THEMES) {
    const page = colorIn(theme, 'bg');
    const surface = colorIn(theme, 'surface');
    const track = colorIn(theme, 'surface-pressed');
    for (const [tone, r] of Object.entries(refs)) {
      const v = Object.fromEntries(
        Object.entries(r).map(([k, role]) => [k, colorIn(theme, role)]),
      );
      const both = (fg, bg, min, what) => {
        assert.ok(contrast(fg, bg) >= min, `${what} sRGB`);
        assert.ok(contrastP3(fg, bg) >= min, `${what} P3`);
      };
      test(`tone ${tone} [${theme}]: all four values are present, inside P3`, () => {
        for (const k of ['low-bg', 'low-fg', 'high-bg', 'high-fg']) {
          assert.ok(v[k], `${k} missing`);
          assert.ok(inP3(v[k]), `${k} ${v[k]} out of P3`);
        }
      });
      test(`tone ${tone} [${theme}]: low text >= 4.5:1 on its tint, on the page and on a surface`, () => {
        both(v['low-fg'], v['low-bg'], 4.5, 'on tint');
        both(v['low-fg'], page, 4.5, 'on page (ghost)');
        both(v['low-fg'], surface, 4.5, 'on surface (ghost)');
      });
      test(`tone ${tone} [${theme}]: high text >= 4.5:1 on its fill; fill >= 3:1 on the page`, () => {
        both(v['high-fg'], v['high-bg'], 4.5, 'text on fill');
        both(v['high-bg'], page, 3, 'fill on page');
      });
      test(`tone ${tone} [${theme}]: progress fill >= 3:1 on its track (surface-pressed)`, () => {
        both(v['high-bg'], track, 3, 'fill on track');
      });
    }
  }
  test('tone fallbacks are the light role values (sRGB hex)', () => {
    for (const [tone, f] of Object.entries(fallbacks))
      for (const [k, hex] of Object.entries(f)) {
        const role = refs[tone][k];
        const want = resolved.modes.default[`color.${role}`].hex;
        assert.equal(hex, want, `${tone} ${k} (${role})`);
      }
  });
  test('the Tag page lists exactly six tones', () => {
    assert.deepEqual(Object.keys(refs).sort(), [
      'accent',
      'danger',
      'info',
      'neutral',
      'success',
      'warning',
    ]);
  });
  // Tags and status badges are the low emphasis: a richer tint (L 0.915, more
  // chroma) with vivid text. Pin the richness so it is not quietly flattened.
  test('tone tints are rich and the tone text is vivid, all inside P3', () => {
    const chroma = (c) => parseFloat(c.split(/\s+/)[1]);
    const light = (c) => parseFloat(c.replace('oklch(', ''));
    const MIN_TINT = {
      accent: 0.043,
      info: 0.043,
      success: 0.07,
      warning: 0.07,
      danger: 0.047,
    };
    const MIN_TEXT = {
      accent: 0.22,
      info: 0.11,
      success: 0.12,
      warning: 0.1,
      danger: 0.18,
    };
    for (const theme of THEMES)
      for (const t of Object.keys(MIN_TINT)) {
        const tint = colorIn(theme, `${t}-surface`);
        const text = colorIn(theme, `${t}-text`);
        assert.ok(inP3(tint) && inP3(text), `${theme} ${t} inside P3`);
        if (theme === 'light') {
          assert.ok(light(tint) <= 0.92, `${t} tint is no paler than L 0.92`);
          assert.ok(chroma(tint) >= MIN_TINT[t], `${t} tint chroma ${tint}`);
          assert.ok(chroma(text) >= MIN_TEXT[t], `${t} text chroma ${text}`);
        }
      }
  });
  test('palette hues: pinker violet, teal blue and cyan, mint green, rose red', () => {
    const hue = (k) => parseFloat(tokIn('light', k).split(/\s+/)[2]);
    const want = {
      violet: [300],
      blue: [235],
      cyan: [192],
      green: [160],
      red: [12],
      magenta: [345],
    };
    for (const [name, [h]] of Object.entries(want))
      for (const step of ['50', '100', '300', '500', '600', '700', '900'])
        assert.equal(hue(`color.${name}.${step}`), h, `${name}.${step}`);
    // Amber walks from a golden 78 toward a warmer 60 as it darkens.
    assert.deepEqual(
      ['50', '500', '600', '700', '900'].map((s) => hue(`color.amber.${s}`)),
      [78, 78, 66, 60, 60],
    );
  });
  test('every ramp step stays inside Display P3 and has an sRGB fallback', () => {
    for (const name of [
      'violet',
      'blue',
      'cyan',
      'green',
      'amber',
      'red',
      'magenta',
    ])
      for (const step of ['50', '100', '300', '500', '600', '700', '900']) {
        const k = `color.${name}.${step}`;
        assert.ok(inP3(tokIn('light', k)), `${k} inside P3`);
        assert.match(resolved.modes.default[k].hex, /^#[0-9a-f]{6}$/);
      }
  });
  test('low-emphasis tags: lowest text contrast (report)', () => {
    let low = { r: 99 };
    for (const theme of THEMES)
      for (const [tone, r] of Object.entries(refs)) {
        const tint = colorIn(theme, r['low-bg']);
        const fg = colorIn(theme, r['low-fg']);
        for (const [what, bg] of [
          ['tint', tint],
          ['page', colorIn(theme, 'bg')],
          ['surface', colorIn(theme, 'surface')],
        ]) {
          const v = Math.min(contrast(fg, bg), contrastP3(fg, bg));
          if (v < low.r) low = { r: v, theme, tone, what };
        }
      }
    console.log(
      `  [lowest tag text] ${low.theme} ${low.tone} on ${low.what}: ${low.r.toFixed(2)}`,
    );
  });
  test('Description list label (text-muted) and value (text) pass on bg and surface', () => {
    for (const theme of THEMES)
      for (const fg of ['text-muted', 'text'])
        for (const bg of ['bg', 'surface'])
          assert.ok(
            contrast(colorIn(theme, fg), colorIn(theme, bg)) >= 4.5,
            `${theme} ${fg} on ${bg}`,
          );
  });
  // The fill is a gradient over its filled width: the tone colour at the
  // leading edge, lifted toward color-lift (white) by progress.fill-lift at the
  // left. Both ends, and so everything between, must hold 3:1 on the track.
  // The fill is a comet: a head and a tail at the leading edge over a base
  // that is lifted toward white at the left. The last ~14px (the head and the
  // full tone) carry the value and must hold 3:1 on the track. The left end is
  // the start of the bar, so it is only reported.
  const PROGRESS_LOWEST = [];
  const LEFT_LOWEST = [];
  for (const theme of THEMES) {
    const track = colorIn(theme, 'surface-pressed');
    const lift = colorIn(theme, 'lift');
    const p = (k) => parseFloat(tokIn(theme, `progress.${k}`)) / 100;
    for (const [tone, r] of Object.entries(refs)) {
      const tonec = colorIn(theme, r['high-bg']);
      // The head's brightest point, its 45% stop, and the full tone.
      const head = mixOklch(tonec, lift, p('head-mix'));
      const shoulder = mixOklch(tonec, lift, p('head-alpha'));
      const left = mixOklch(tonec, lift, p('fill-lift'));
      test(`tone ${tone} [${theme}]: comet, the last 14px (head, shoulder, full tone) >= 3:1 on the track`, () => {
        for (const [what, c] of [
          ['full tone', tonec],
          ['head (brightest)', head],
          ['head shoulder (45%)', shoulder],
        ]) {
          const a = contrast(c, track);
          const b = contrastP3(c, track);
          PROGRESS_LOWEST.push({ theme, tone, what, a, b });
          assert.ok(a >= 3, `${what} sRGB ${a.toFixed(2)}`);
          assert.ok(b >= 3, `${what} P3 ${b.toFixed(2)}`);
        }
        LEFT_LOWEST.push({
          theme,
          tone,
          a: contrast(left, track),
          b: contrastP3(left, track),
        });
      });
    }
  }
  test('progress track: faint inset shadow, no border, stronger in dark', () => {
    assert.match(
      resolved.modes.default['elevation.track'].value,
      /^inset 0 0 2px 0 oklch\([^)]* \/ 0\.06\)$/,
    );
    assert.match(
      resolved.themes.dark['elevation.track'].value,
      /^inset 0 0 2px 0 oklch\([^)]* \/ 0\.3\)$/,
    );
  });
  test('progress comet tokens: lift 30/45, head 16/80 + 12/25, tail 70% to 280px, glow 45/60', () => {
    const v = (k) => [tokIn('light', k), tokIn('dark', k)];
    assert.deepEqual(v('progress.fill-lift'), ['30%', '45%']);
    assert.deepEqual(v('progress.head-mix'), ['16%', '80%']);
    assert.deepEqual(v('progress.head-alpha'), ['12%', '25%']);
    assert.deepEqual(v('progress.glow-alpha'), ['45%', '60%']);
    assert.equal(tokIn('light', 'progress.tail-alpha'), '70%');
    assert.equal(tokIn('light', 'progress.head-size'), 14);
    assert.equal(tokIn('light', 'progress.tail-max'), 280);
    assert.equal(tokIn('light', 'progress.tail-min-fill'), 24);
  });
  test('progress comet: lowest contrast on the track (report)', () => {
    const m = PROGRESS_LOWEST.reduce((x, y) =>
      Math.min(y.a, y.b) < Math.min(x.a, x.b) ? y : x,
    );
    console.log(
      `  [lowest progress head/tone] ${m.theme} ${m.tone} ${m.what}: sRGB ${m.a.toFixed(2)}, P3 ${m.b.toFixed(2)}`,
    );
    const l = LEFT_LOWEST.reduce((x, y) =>
      Math.min(y.a, y.b) < Math.min(x.a, x.b) ? y : x,
    );
    console.log(
      `  [lowest progress left end, report only] ${l.theme} ${l.tone}: sRGB ${l.a.toFixed(2)}, P3 ${l.b.toFixed(2)}`,
    );
  });
}

test('state-layer contrast: lowest ratios (report)', () => {
  for (const kind of ['text', 'icon', 'border']) {
    const rows = MATRIX_RESULTS.filter((m) => m.kind === kind);
    if (!rows.length) continue;
    const m = rows.reduce((a, b) =>
      Math.min(b.r, b.rx) < Math.min(a.r, a.rx) ? b : a,
    );
    console.log(
      `  [lowest ${kind}] ${m.theme} ${m.surface} ${m.state} ${m.fg}: sRGB ${m.r.toFixed(2)}, P3 ${m.rx.toFixed(2)}`,
    );
  }
});
