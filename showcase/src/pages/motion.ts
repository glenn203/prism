import { html } from 'lit';

export const motionPage = () => html`
  <div class="page-head">
    <h1>Motion</h1>
    <p>
      Press-scale, the invalid-field nudge, the floating-label spring, checkbox
      and radio squish, the check-mark draw, and the segmented indicator
      springs. They run only where <code>data-prism-polish</code> includes
      <code>motion</code> (or all effects), and they stay still under reduced
      motion. The left column is still; the right column moves.
    </p>
  </div>
  <div class="panel-grid">
    <section class="panel" data-prism-polish="off">
      <h2>Motion off</h2>
      ${demo()}
    </section>
    <section class="panel" data-prism-polish="motion">
      <h2>Motion on</h2>
      ${demo()}
    </section>
  </div>
`;

const demo = () => html`
  <div class="preview-row">
    <prism-button>Primary</prism-button>
    <prism-button variant="secondary" pressed>Selected</prism-button>
    <prism-button variant="outline">Outline</prism-button>
    <prism-tag selectable selected>Lumen OS</prism-tag>
    <prism-tag selectable>Spectra OS</prism-tag>
  </div>
  <prism-checkbox label="Email me a weekly summary"></prism-checkbox>
  <prism-radio-group label="Cadence" value="weekly">
    <prism-radio value="daily" label="Daily"></prism-radio>
    <prism-radio value="weekly" label="Weekly"></prism-radio>
    <prism-radio value="monthly" label="Monthly"></prism-radio>
  </prism-radio-group>
  <prism-segmented-control label="Range" value="week">
    <prism-segment value="day">Day</prism-segment>
    <prism-segment value="week">Week</prism-segment>
    <prism-segment value="month">Month</prism-segment>
  </prism-segmented-control>
  <prism-text-input
    label="Plate name"
    floating
    clearable
    value="Aurora 9"
  ></prism-text-input>
  <prism-select label="Focal length" value="50">
    <prism-option value="24">24 mm</prism-option>
    <prism-option value="50">50 mm</prism-option>
    <prism-option value="85">85 mm</prism-option>
  </prism-select>
  <form
    @submit=${(e: Event) => {
      e.preventDefault();
      const field = (e.currentTarget as HTMLFormElement).querySelector(
        'prism-text-input',
      ) as HTMLElement & { reportValidity?: () => boolean };
      field.reportValidity?.();
    }}
    style="display:grid;gap:12px"
  >
    <prism-text-input label="Email" type="email" name="email" required>
      <span slot="error">Enter an email address.</span>
    </prism-text-input>
    <prism-button type="submit">Submit</prism-button>
  </form>
`;
