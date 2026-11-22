import { html, type TemplateResult } from 'lit';

const panel = (title: string, scope: string, inner: TemplateResult) =>
  html`<section class="panel" data-prism-polish=${scope}>
    <h2>${title}</h2>
    ${inner}
  </section>`;

const sample = () => html`
  <prism-card type="clickable" raised>
    <prism-running-indicator
      slot="header"
      data-prism-card-icon
      size="sm"
      tone="success"
      label="lumen-board-01 is online"
    ></prism-running-indicator>
    <prism-card-title slot="header" level="3" href="#lumen-board-01"
      >lumen-board-01</prism-card-title
    >
    <prism-tag slot="header" job="health" tone="success" emphasis="ghost"
      >Online</prism-tag
    >
    <prism-card-description slot="header"
      >Lumen Board 9, Aurora Bay</prism-card-description
    >
    <prism-progress
      label="Storage used"
      value="72"
      show-value
      tone="warning"
    ></prism-progress>
    <prism-card-meta slot="footer">Updated 4 min ago</prism-card-meta>
  </prism-card>
  <prism-card raised>
    <prism-card-title slot="header" level="3">Spectrum notes</prism-card-title>
    <prism-card-description slot="header"
      >A card that is not a link: it tilts and rounds, but gets no light
      ring.</prism-card-description
    >
    <p style="margin:0">Hover it to see the lean.</p>
    <prism-card-meta slot="footer">Static card</prism-card-meta>
    <prism-card-actions slot="footer">
      <prism-button variant="ghost">Dismiss</prism-button>
    </prism-card-actions>
  </prism-card>
  <div class="preview-row">
    <prism-button>Primary</prism-button>
    <prism-button variant="secondary">Secondary</prism-button>
    <prism-button variant="outline">Outline</prism-button>
    <prism-button variant="ghost">Ghost</prism-button>
    <prism-button disabled>Disabled</prism-button>
  </div>
  <div class="preview-row">
    <prism-tag tone="info">Info</prism-tag>
    <prism-tag tone="success" emphasis="high">Ready</prism-tag>
    <prism-tag tone="warning" emphasis="ghost">Dimming</prism-tag>
  </div>
  <prism-text-input label="Panel name" value="Aurora 9"></prism-text-input>
  <prism-switch label="Auto-refresh" checked></prism-switch>
`;

export const polishPage = () => html`
  <div class="page-head">
    <h1>Polish</h1>
    <p>
      An opt-in layer of four small effects. Load
      <code>prism/polish.css</code> after the theme, call
      <code>enablePolish()</code>, and set <code>data-prism-polish</code> on
      <code>html</code> or on a section. The panels below set their own scope,
      so they look the same whatever the header switch says.
    </p>
  </div>
  <div class="panel-grid">
    ${panel('Polish off', 'off', sample())}
    ${panel('Polish on', 'all', sample())}
  </div>
  <div class="panel-grid">
    ${panel('Round corners', 'off', sample())}
    ${panel('Squircle corners', 'squircle', sample())}
  </div>
  <div class="panel-grid">
    ${panel('Light-following border', 'light', sample())}
    ${panel('Card tilt', 'tilt', sample())}
  </div>
  <section class="section" style="max-inline-size:480px">
    ${panel(
      'Running job, polish on',
      'all',
      html`<prism-card standalone raised>
        <prism-running-indicator
          slot="header"
          data-prism-card-icon
          size="sm"
          label="Export running"
        ></prism-running-indicator>
        <prism-card-title slot="header" level="3"
          >Lumen Bloom export</prism-card-title
        >
        <prism-tag slot="header" job="status" tone="accent"
          >In progress</prism-tag
        >
        <prism-card-description slot="header"
          >Preview render for 12 panels</prism-card-description
        >
        <prism-progress
          label="Panels rendered"
          value="7"
          max="12"
          value-text="7 of 12 panels"
          show-value
        ></prism-progress>
        <prism-switch
          label="Notify me when it finishes"
          size="sm"
          checked
          style="margin-block-start:16px"
        ></prism-switch>
        <prism-card-meta slot="footer">Started 2 min ago</prism-card-meta>
        <prism-card-actions slot="footer">
          <prism-button variant="secondary">Stop</prism-button>
        </prism-card-actions>
      </prism-card>`,
    )}
  </section>
`;
