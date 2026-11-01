import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../button/define.js';

interface Args {
  label: string;
  value: string;
  size: 'sm' | 'md' | 'lg';
  disabled: boolean;
  fullWidth: boolean;
}

const meta: Meta<Args> = {
  title: 'Components/Segmented control',
  component: 'prism-segmented-control',
  args: {
    label: 'Time range',
    value: 'week',
    size: 'md',
    disabled: false,
    fullWidth: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  render: (a) =>
    html`<prism-segmented-control
      label=${a.label}
      value=${a.value}
      size=${a.size}
      ?disabled=${a.disabled}
      ?full-width=${a.fullWidth}
    >
      <prism-segment value="day">Day</prism-segment>
      <prism-segment value="week">Week</prism-segment>
      <prism-segment value="month">Month</prism-segment>
    </prism-segmented-control>`,
};
export default meta;
type Story = StoryObj<Args>;

/**
 * One choice from a few, with one indicator that slides to it. Click, or Tab
 * to the control and use the arrow keys (they move focus and pick together).
 * The indicator is two springs, one per edge: the edge that
 * leads is quick and bouncy, the one behind follows, so the shape stretches on
 * the way and pulls together on the new segment. Pick again mid-move and it
 * turns round from where it is. Pressing a segment squishes it evenly by about
 * 3%. Under reduced motion it jumps and only the colours change.
 */
export const Default: Story = {};

/** Nothing picked: no indicator. The first pick fades it in on the segment. */
export const NoneSelected: Story = { args: { value: '' } };

/** Icons with text, and icon-only segments (they need a `label`). */
export const WithIcons: Story = {
  render: () =>
    html`<div style="display:grid;gap:20px;justify-items:start">
      <prism-segmented-control label="Layout" value="list">
        <prism-segment value="list">
          <svg
            slot="icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <path d="M3 4h10M3 8h10M3 12h10" />
          </svg>
          List
        </prism-segment>
        <prism-segment value="grid">
          <svg
            slot="icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="3" y="3" width="4" height="4" />
            <rect x="9" y="3" width="4" height="4" />
            <rect x="3" y="9" width="4" height="4" />
            <rect x="9" y="9" width="4" height="4" />
          </svg>
          Grid
        </prism-segment>
      </prism-segmented-control>
      <prism-segmented-control
        label="Layout, icons only"
        hide-label
        value="grid"
        size="sm"
      >
        <prism-segment value="list" label="List">
          <svg
            slot="icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <path d="M3 4h10M3 8h10M3 12h10" />
          </svg>
        </prism-segment>
        <prism-segment value="grid" label="Grid">
          <svg
            slot="icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="3" y="3" width="4" height="4" />
            <rect x="9" y="3" width="4" height="4" />
            <rect x="3" y="9" width="4" height="4" />
            <rect x="9" y="9" width="4" height="4" />
          </svg>
        </prism-segment>
      </prism-segmented-control>
    </div>`,
};

/** Small, medium and large follow the control heights and density. */
export const Sizes: Story = {
  render: () =>
    html`<div style="display:grid;gap:16px;justify-items:start">
      ${(['sm', 'md', 'lg'] as const).map(
        (size) =>
          html`<prism-segmented-control
            label=${`Size ${size}`}
            size=${size}
            value="b"
          >
            <prism-segment value="a">Short</prism-segment>
            <prism-segment value="b">A longer label</prism-segment>
            <prism-segment value="c">Mid</prism-segment>
          </prism-segmented-control>`,
      )}
    </div>`,
};

/** `full-width` shares the row equally. The indicator morphs between unequal segments too. */
export const FullWidth: Story = {
  render: () =>
    html`<div style="max-inline-size:480px;display:grid;gap:16px">
      <prism-segmented-control label="Plan" value="team" full-width>
        <prism-segment value="starter">Starter</prism-segment>
        <prism-segment value="team">Team</prism-segment>
        <prism-segment value="studio">Studio</prism-segment>
      </prism-segmented-control>
      <prism-segmented-control label="Unequal widths" value="a">
        <prism-segment value="a">Day</prism-segment>
        <prism-segment value="b">Month to date</prism-segment>
        <prism-segment value="c">All</prism-segment>
      </prism-segmented-control>
    </div>`,
};

/** A disabled segment is skipped by the arrows; a disabled control picks nothing. */
export const Disabled: Story = {
  render: () =>
    html`<div style="display:grid;gap:16px;justify-items:start">
      <prism-segmented-control label="One segment off" value="day">
        <prism-segment value="day">Day</prism-segment>
        <prism-segment value="week" disabled>Week</prism-segment>
        <prism-segment value="month">Month</prism-segment>
      </prism-segmented-control>
      <prism-segmented-control label="Whole control off" value="week" disabled>
        <prism-segment value="day">Day</prism-segment>
        <prism-segment value="week">Week</prism-segment>
        <prism-segment value="month">Month</prism-segment>
      </prism-segmented-control>
    </div>`,
};

/** Right-to-left: the row mirrors and the indicator follows. Left and Right swap where the browser does it (not WebKit). */
export const RightToLeft: Story = {
  render: () =>
    html`<div dir="rtl">
      <prism-segmented-control label="Range" value="b">
        <prism-segment value="a">Day</prism-segment>
        <prism-segment value="b">Week</prism-segment>
        <prism-segment value="c">Month</prism-segment>
      </prism-segmented-control>
    </div>`,
};

/** In a form: it submits `range`, is required, and resets to its starting segment. */
export const InAForm: Story = {
  render: () =>
    html`<form
      style="display:grid;gap:12px;justify-items:start"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const out = (e.target as HTMLFormElement).querySelector('output')!;
        out.textContent = `Submitted: ${JSON.stringify(Object.fromEntries(new FormData(e.target as HTMLFormElement)))}`;
      }}
    >
      <prism-segmented-control name="range" label="Report range" required>
        <span slot="description">Pick one to continue.</span>
        <prism-segment value="day">Day</prism-segment>
        <prism-segment value="week">Week</prism-segment>
        <prism-segment value="month">Month</prism-segment>
        <span slot="error">Pick a range to continue.</span>
      </prism-segmented-control>
      <div style="display:flex;gap:8px">
        <prism-button type="submit">Run report</prism-button>
        <prism-button type="reset" variant="outline">Reset</prism-button>
      </div>
      <output></output>
    </form>`,
};
