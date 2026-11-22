import type { Meta, StoryObj } from '@storybook/web-components';
import { html, svg } from 'lit';
import resolvedJson from '../../tokens/prism.tokens.resolved.json?raw';

const meta: Meta = {
  title: 'Foundations/Color',
  tags: ['!autodocs'],
  parameters: { a11y: { test: 'error' }, layout: 'padded' },
};
export default meta;

interface Entry {
  value: string;
  hex: string;
  gamut?: string;
}
const data = JSON.parse(resolvedJson) as {
  modes: { default: Record<string, Entry> };
  themes: { dark: Record<string, Entry> };
};
const LIGHT = data.modes.default;
const DARK = data.themes.dark;
const lookup = (theme: 'light' | 'dark', key: string): Entry | undefined =>
  (theme === 'dark' ? DARK[key] : undefined) ?? LIGHT[key];

/** WCAG 2 contrast of two sRGB hex colours (the fallback tier). */
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const WHITE = LIGHT['neutral.0']!.hex;
const INK = LIGHT['neutral.950']!.hex;

const styles = html`<style>
  .c-page {
    display: grid;
    gap: var(--prism-space-8);
    max-inline-size: 1080px;
    font-family: var(--prism-font-family-sans);
    color: var(--prism-color-text);
  }
  .c-page h2 {
    margin: 0 0 var(--prism-space-2);
    font-size: var(--prism-font-size-20);
    line-height: var(--prism-font-line-height-28);
  }
  .c-page h3 {
    margin: 0 0 var(--prism-space-2);
    font-size: var(--prism-font-size-16);
    line-height: var(--prism-font-line-height-24);
    text-transform: capitalize;
  }
  .c-page p {
    margin: 0;
    max-inline-size: 68ch;
  }
  .c-muted {
    color: var(--prism-color-text-muted);
  }
  .c-bar {
    block-size: 56px;
    border-radius: var(--prism-radius-9);
  }
  .c-bars {
    display: grid;
    gap: var(--prism-space-3);
    margin-block-start: var(--prism-space-4);
  }
  .c-bars span {
    font: var(--prism-text-caption-font-weight)
      var(--prism-text-caption-font-size) /
      var(--prism-text-caption-line-height) var(--prism-font-family-mono);
    color: var(--prism-color-text-muted);
  }
  .c-ramp {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
    gap: var(--prism-space-3);
  }
  .c-sw {
    border: var(--prism-border-width) solid var(--prism-color-border);
    border-radius: var(--prism-radius-7);
    overflow: hidden;
    background: var(--prism-color-bg);
  }
  .c-chip {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    block-size: 72px;
    padding: var(--prism-space-2);
    font: 600 var(--prism-font-size-12) / var(--prism-font-line-height-16)
      var(--prism-font-family-sans);
  }
  .c-meta {
    display: grid;
    padding: var(--prism-space-2);
    font: var(--prism-text-caption-font-weight)
      var(--prism-text-caption-font-size) /
      var(--prism-text-caption-line-height) var(--prism-font-family-mono);
    color: var(--prism-color-text-muted);
    overflow-wrap: anywhere;
  }
  .c-meta b {
    font-family: var(--prism-font-family-sans);
    font-weight: 600;
    color: var(--prism-color-text);
  }
  .c-p3 {
    font-family: var(--prism-font-family-sans);
    font-weight: 600;
    color: var(--prism-color-accent-text);
  }
  .c-themes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: var(--prism-space-4);
  }
  .c-panel {
    display: grid;
    gap: var(--prism-space-4);
    padding: var(--prism-space-6);
    border: var(--prism-border-width) solid var(--prism-color-border);
    border-radius: var(--prism-radius-11);
    background: var(--prism-color-bg);
    color: var(--prism-color-text);
  }
  .c-roles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--prism-space-2);
  }
  .c-role {
    display: flex;
    align-items: center;
    gap: var(--prism-space-2);
    font: var(--prism-text-caption-font-weight)
      var(--prism-text-caption-font-size) /
      var(--prism-text-caption-line-height) var(--prism-font-family-mono);
  }
  .c-dot {
    flex: none;
    inline-size: 20px;
    block-size: 20px;
    border-radius: var(--prism-radius-full);
    border: var(--prism-border-width) solid var(--prism-color-border-strong);
  }
  .c-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--prism-space-2);
    align-items: center;
  }
  .c-table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--prism-font-size-14);
  }
  .c-table th,
  .c-table td {
    padding: var(--prism-space-2) var(--prism-space-3);
    border-block-end: var(--prism-border-width) solid var(--prism-color-border);
    text-align: start;
  }
  .c-table td {
    font-variant-numeric: tabular-nums;
  }
  .c-stage {
    border-radius: var(--prism-radius-11);
    overflow: hidden;
    background: var(--prism-color-bg);
  }
  .c-stage svg {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }
  .c-airy {
    display: grid;
    gap: var(--prism-space-4);
    padding: var(--prism-space-8);
    border-radius: var(--prism-radius-11);
    background: var(--prism-gradient-mist);
    color: var(--prism-color-text);
  }
  .c-airy h2 {
    margin: 0;
    font-size: var(--prism-font-size-28);
    line-height: var(--prism-font-line-height-36);
  }
  .c-ray {
    block-size: 4px;
    border-radius: var(--prism-radius-full);
    background: var(--prism-gradient-spectrum);
  }
</style>`;

const HUES = [
  'violet',
  'blue',
  'cyan',
  'green',
  'amber',
  'red',
  'magenta',
] as const;
const STEPS = ['50', '100', '300', '500', '600', '700', '900'] as const;
const SLATE = [
  '0',
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
];

const chip = (cssVar: string, label: string, e: Entry | undefined) => {
  if (!e) return html``;
  // Label the chip with whichever of white or ink reads better on it.
  const [w, k] = [ratio(WHITE, e.hex), ratio(INK, e.hex)];
  const [fg, r] = w >= k ? [WHITE, w] : [INK, k];
  return html`<div class="c-sw">
    <div class="c-chip" style="background: var(${cssVar}); color: ${fg}">
      <span>Aa</span><span>${r.toFixed(1)}:1</span>
    </div>
    <div class="c-meta">
      <b>${label}</b>
      <span>${e.value}</span>
      <span>${e.hex}</span>
      ${e.gamut === 'p3' ? html`<span class="c-p3">Display P3</span>` : ''}
    </div>
  </div>`;
};

const swatch = (ramp: string, step: string) =>
  chip(
    `--prism-color-${ramp}-${step}`,
    `${ramp}-${step}`,
    LIGHT[`color.${ramp}.${step}`],
  );

const bandSwatch = (step: string) =>
  chip(`--prism-neutral-${step}`, `neutral-${step}`, LIGHT[`neutral.${step}`]);

/** Every ramp: the neutral and the refraction spectrum. */
export const Palette: StoryObj = {
  render: () =>
    html`${styles}
      <div class="c-page">
        <section>
          <h2>Prism color</h2>
          <p>
            White light enters, the spectrum leaves. Prism is one hued neutral
            band (near black and white, with a slight hint of blue) and seven
            spectral hues. Defaults use the band; colour is for meaning (error
            and focus). Each spectral hue has seven steps, and the vivid ones
            are written for Display P3 in OKLCH. Screens that cannot show P3 get
            the same color pulled back into sRGB at the same lightness and hue,
            and engines without oklch() get the hex.
          </p>
          <div class="c-bars">
            <div
              class="c-bar"
              style="background: var(--prism-gradient-spectrum)"
              role="img"
              aria-label="The spectrum gradient, violet through magenta"
            ></div>
            <span>--prism-gradient-spectrum</span>
            <div
              class="c-bar"
              style="background: var(--prism-gradient-refract)"
              role="img"
              aria-label="The refract gradient, violet into cyan"
            ></div>
            <span>--prism-gradient-refract</span>
            <div
              class="c-bar"
              style="background: var(--prism-gradient-mist); border: 1px solid var(--prism-color-border)"
              role="img"
              aria-label="The mist gradient, pale tints"
            ></div>
            <span>--prism-gradient-mist</span>
          </div>
        </section>
        <section>
          <h2>Spectrum</h2>
          <p class="c-muted">
            Steps 50 and 100 are airy tints. 300 is text on dark. 500 is the
            vivid signature. 600 carries white text. 700 is text on light. 900
            is a deep tint for dark surfaces. The number on each chip is the
            best contrast of white or ink on that color.
          </p>
        </section>
        ${HUES.map(
          (h) =>
            html`<section>
              <h3>${h}</h3>
              <div class="c-ramp">
                ${STEPS.map((s) => swatch(h, s))}
                ${h === 'red' ? swatch('red', '800') : ''}
              </div>
            </section>`,
        )}
        <section>
          <h3>neutral</h3>
          <p class="c-muted">
            The default band. Hue 255, low chroma, near-white to near-black, so
            surfaces read as almost black and white with a slight hint of blue.
            <code>--prism-color-slate-*</code> is an alias of the same steps.
          </p>
          <div class="c-ramp">${SLATE.map((s) => bandSwatch(s))}</div>
        </section>
      </div>`,
};

const ROLE_SAMPLES = [
  'bg',
  'surface',
  'text',
  'text-muted',
  'border',
  'border-strong',
  'accent',
  'on-accent',
  'accent-text',
  'accent-surface',
  'focus-ring',
  'focus-border',
  'info',
  'success',
  'warning',
  'danger',
];
const TONES = ['neutral', 'accent', 'info', 'success', 'warning', 'danger'];

const themePanel = (theme: 'light' | 'dark') =>
  html`<div class="c-panel" data-prism-theme=${theme}>
    <div>
      <h3>${theme}</h3>
      <p class="c-muted">
        <code>data-prism-theme="${theme}"</code> on any element.
      </p>
    </div>
    <div class="c-roles">
      ${ROLE_SAMPLES.map(
        (r) =>
          html`<span class="c-role"
            ><span
              class="c-dot"
              style="background: var(--prism-color-${r})"
            ></span
            >${r}</span
          >`,
      )}
    </div>
    <div class="c-row">
      <prism-button type="button">Primary</prism-button>
      <prism-button type="button" variant="secondary">Secondary</prism-button>
      <prism-button type="button" variant="outline">Outline</prism-button>
      <prism-button type="button" variant="ghost">Ghost</prism-button>
      <prism-button type="button" variant="destructive">Delete</prism-button>
    </div>
    <div class="c-row">
      ${TONES.map(
        (t) => html`<prism-tag tone=${t} emphasis="low">${t}</prism-tag>`,
      )}
    </div>
    <div class="c-row">
      ${TONES.map(
        (t) => html`<prism-tag tone=${t} emphasis="high">${t}</prism-tag>`,
      )}
    </div>
    <prism-progress
      label="Spectrum coverage"
      value="72"
      max="100"
      show-value
      tone="accent"
    ></prism-progress>
  </div>`;

/** The same roles in light and dark. Components only read roles, so nothing else changes. */
export const LightAndDark: StoryObj = {
  render: () =>
    html`${styles}
      <div class="c-page">
        <section>
          <h2>Light and dark</h2>
          <p>
            Light is the default. Opt a subtree into dark with
            <code>data-prism-theme="dark"</code>, or use
            <code>data-prism-theme="auto"</code> to follow the system setting.
            The solid fills lighten in dark and switch to ink text, so every
            pair keeps its contrast.
          </p>
        </section>
        <div class="c-themes">${themePanel('light')} ${themePanel('dark')}</div>
      </div>`,
};

const PAIRS: [string, string, number, string][] = [
  ['text', 'bg', 4.5, 'Body text'],
  ['text-muted', 'surface', 4.5, 'Secondary text on a surface'],
  ['on-accent', 'accent', 4.5, 'Primary button label'],
  ['accent-text', 'accent-surface', 4.5, 'Accent tag'],
  ['info-text', 'info-surface', 4.5, 'Info tag'],
  ['success-text', 'success-surface', 4.5, 'Success tag'],
  ['warning-text', 'warning-surface', 4.5, 'Warning tag'],
  ['danger-text', 'danger-surface', 4.5, 'Danger tag'],
  ['on-solid', 'info', 4.5, 'Solid info tag'],
  ['on-solid', 'success', 4.5, 'Solid success tag'],
  ['on-solid', 'warning', 4.5, 'Solid warning tag'],
  ['on-solid', 'danger', 4.5, 'Solid danger tag'],
  ['border-strong', 'bg', 3, 'Input and outline borders'],
  ['focus-ring', 'bg', 3, 'Focus ring'],
  ['accent', 'surface-pressed', 3, 'Progress fill on its track'],
];

/** Contrast of every text and control pair that ships, measured on the sRGB fallback. */
export const Contrast: StoryObj = {
  render: () =>
    html`${styles}
      <div class="c-page">
        <section>
          <h2>Contrast</h2>
          <p>
            WCAG 2 AA: 4.5:1 for text, 3:1 for borders, focus rings and solid
            fills. The test suite checks every pair in both themes on the sRGB
            fallback and on the full-chroma Display P3 values.
          </p>
        </section>
        <table class="c-table">
          <caption
            class="c-muted"
            style="text-align: start; padding-block: 8px"
          >
            Ratios from the hex fallbacks
          </caption>
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col">Use</th>
              <th scope="col">Needs</th>
              <th scope="col">Light</th>
              <th scope="col">Dark</th>
            </tr>
          </thead>
          <tbody>
            ${PAIRS.map(([fg, bg, min, use]) => {
              const r = (['light', 'dark'] as const).map((t) =>
                ratio(
                  lookup(t, `color.${fg}`)!.hex,
                  lookup(t, `color.${bg}`)!.hex,
                ),
              ) as [number, number];
              return html`<tr>
                <th scope="row">${fg} on ${bg}</th>
                <td>${use}</td>
                <td>${min}:1</td>
                <td>${r[0].toFixed(2)}:1 ${r[0] >= min ? 'Pass' : 'Fail'}</td>
                <td>${r[1].toFixed(2)}:1 ${r[1] >= min ? 'Pass' : 'Fail'}</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>`,
};

const BANDS = [
  'red',
  'amber',
  'green',
  'cyan',
  'blue',
  'violet',
  'magenta',
] as const;

/** A beam of white light, a glass prism, and the spectrum it throws. */
export const Refraction: StoryObj = {
  render: () => {
    const y0 = 172;
    const step = 17;
    const origin = [456, 146];
    const bands = BANDS.map((h, i) => {
      const [a, b] = [y0 + i * step, y0 + (i + 1) * step];
      return svg`<polygon
        points="${origin[0]},${origin[1]} 800,${a} 800,${b}"
        style="fill: var(--prism-color-${h}-500)"
      />`;
    });
    return html`${styles}
      <div class="c-page">
        <section>
          <h2>Refraction</h2>
          <p>
            Light, split and mixed. The stage is a dark scope so the beam can
            glow. The bands are the 500 step of each spectral hue, and on a
            Display P3 screen they run at full chroma.
          </p>
        </section>
        <div class="c-stage" data-prism-theme="dark">
          <svg
            viewBox="0 0 800 320"
            role="img"
            aria-label="A beam of white light enters a glass prism and fans out into the spectrum, red through magenta"
          >
            <defs>
              <linearGradient id="beam" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stop-color="#fff" stop-opacity="0" />
                <stop offset="1" stop-color="#fff" stop-opacity="1" />
              </linearGradient>
              <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#fff" stop-opacity="0.22" />
                <stop offset="1" stop-color="#fff" stop-opacity="0.04" />
              </linearGradient>
              <filter id="glow" x="-10%" y="-30%" width="120%" height="160%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            <g filter="url(#glow)" opacity="0.7" style="mix-blend-mode: screen">
              ${bands}
            </g>
            <g opacity="0.92" style="mix-blend-mode: screen">${bands}</g>
            <polygon points="400,50 310,205 490,205" fill="url(#glass)" />
            <polygon
              points="400,50 310,205 490,205"
              fill="none"
              stroke-width="1.5"
              style="stroke: var(--prism-color-border)"
              stroke-linejoin="round"
            />
            <polygon
              points="40,196 341,151 456,146 341,155"
              fill="url(#beam)"
            />
            <line
              x1="341"
              y1="153"
              x2="456"
              y2="146"
              stroke="#fff"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="c-airy">
          <div class="c-ray" aria-hidden="true"></div>
          <h2>Airy by default</h2>
          <p>
            Pale tints sit behind text with room to spare, and the color shows
            up only where it means something: the action, the focus ring, the
            status. Everything else stays clear glass.
          </p>
          <div class="c-row">
            <prism-button type="button">Split the light</prism-button>
            <prism-button type="button" variant="secondary"
              >Mix it back</prism-button
            >
            <prism-tag tone="accent">Refracted</prism-tag>
            <prism-tag tone="info">Cool</prism-tag>
            <prism-tag tone="success">Clear</prism-tag>
            <prism-tag tone="warning">Warm</prism-tag>
          </div>
        </div>
      </div>`;
  },
};
