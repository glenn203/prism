import { html, svg } from 'lit';

const HUES = [
  'red',
  'amber',
  'green',
  'cyan',
  'blue',
  'violet',
  'magenta',
] as const;

const sample = () => html`
  <div class="preview-row">
    <prism-button>Save</prism-button>
    <prism-button variant="secondary">Export</prism-button>
    <prism-button variant="outline">Outline</prism-button>
    <prism-tag tone="accent" emphasis="high">Accent</prism-tag>
    <prism-progress
      label="Render"
      value="64"
      tone="accent"
      show-value
      style="flex:1;min-inline-size:min(180px,100%)"
    ></prism-progress>
  </div>
`;

const refraction = () => {
  const y0 = 172;
  const step = 17;
  const origin = [456, 146];
  const bands = HUES.map((h, i) => {
    const a = y0 + i * step;
    const b = y0 + (i + 1) * step;
    return svg`<polygon
      points="${origin[0]},${origin[1]} 800,${a} 800,${b}"
      style="fill: var(--prism-color-${h}-500)"
    />`;
  });
  return html`<div class="stage" data-prism-theme="dark">
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
      <polygon points="40,196 341,151 456,146 341,155" fill="url(#beam)" />
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
  </div>`;
};

export const accentPage = () => html`
  <div class="page-head">
    <h1>Spectral accent</h1>
    <p>
      Defaults use the hued neutral band, with colour only for meaning (error
      and focus). Load <code>prism/accent.css</code> after the theme to restore
      the brand violet. The header switch turns that sheet on and off; the
      panels below also compare the two in one view.
    </p>
  </div>
  <div class="compare">
    <section class="panel neutral-scope">
      <h2>Neutral default</h2>
      ${sample()}
    </section>
    <section class="panel accent-scope">
      <h2>Spectral accent</h2>
      ${sample()}
    </section>
  </div>
  <section class="section">
    <h2>Refraction</h2>
    <p class="lede">
      Light, split and mixed. The stage is a dark scope so the beam can glow.
      The bands are the 500 step of each spectral hue.
    </p>
    ${refraction()}
  </section>
  <section class="section">
    <h2>Hue steps</h2>
    <div class="swatches">
      ${HUES.map(
        (h) =>
          html`<div class="swatch">
            <i style="background: var(--prism-color-${h}-500)"></i>
            ${h}
          </div>`,
      )}
    </div>
  </section>
`;
