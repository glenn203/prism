import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../button/define.js';

interface Args {
  label: string;
  checked: boolean;
  disabled: boolean;
  size: 'sm' | 'md' | 'lg';
  hideLabel: boolean;
  labelPosition: 'end' | 'start';
}

const meta: Meta<Args> = {
  title: 'Components/Switch',
  component: 'prism-switch',
  args: {
    label: 'Auto-refresh',
    checked: false,
    disabled: false,
    size: 'md',
    hideLabel: false,
    labelPosition: 'end',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    labelPosition: { control: 'inline-radio', options: ['end', 'start'] },
  },
  render: ({ label, checked, disabled, size, hideLabel, labelPosition }) =>
    html`<prism-switch
      label=${label}
      size=${size}
      label-position=${labelPosition}
      ?checked=${checked}
      ?disabled=${disabled}
      ?hide-label=${hideLabel}
    ></prism-switch>`,
};
export default meta;

const reference = { parameters: { controls: { disable: true } } };
type Story = StoryObj<Args>;

/**
 * An on/off control that takes effect right away. A native checkbox with the
 * `switch` attribute, labelled only by its `<label for>`. Click it, or press
 * Space when it has focus.
 */
export const Default: Story = { ...reference };

/** Starts on. The thumb sits at the end, and the track is filled. */
export const On: Story = { ...reference, args: { checked: true } };

/** Disabled keeps its position: the thumb still says on or off. */
export const Disabled: Story = {
  ...reference,
  render: () =>
    html`<div style="display:grid;gap:12px">
      <prism-switch label="Sync over mobile data" disabled></prism-switch>
      <prism-switch label="Share usage notes" checked disabled></prism-switch>
    </div>`,
};

/** Sizes: sm (24px tall), md (28px) and lg (32px). All keep a 24px minimum target. */
export const Sizes: Story = {
  ...reference,
  render: () =>
    html`<div style="display:grid;gap:12px">
      ${(['sm', 'md', 'lg'] as const).map(
        (s) =>
          html`<div style="display:flex;gap:24px;align-items:center">
            <prism-switch label="Size ${s}, off" size=${s}></prism-switch>
            <prism-switch
              label="Size ${s}, on"
              size=${s}
              checked
            ></prism-switch>
          </div>`,
      )}
    </div>`,
};

/** All four looks side by side, so you can compare off, on and disabled. */
export const States: Story = {
  ...reference,
  render: () =>
    html`<div style="display:grid;gap:12px">
      <prism-switch label="Off"></prism-switch>
      <prism-switch label="On" checked></prism-switch>
      <prism-switch label="Off, disabled" disabled></prism-switch>
      <prism-switch label="On, disabled" checked disabled></prism-switch>
    </div>`,
};

/**
 * The label can be hidden from sight when another word on the page already
 * names the setting. It still names the switch for screen readers.
 */
export const HiddenLabel: Story = {
  ...reference,
  render: () =>
    html`<div style="display:flex;gap:12px;align-items:center">
      <span aria-hidden="true">Dark preview</span>
      <prism-switch label="Dark preview" hide-label></prism-switch>
    </div>`,
};

/**
 * Inside a form. While on, the switch submits its `value` (default "on")
 * under its `name`. While off it submits nothing. Reset puts it back to how it
 * started.
 */
export const InForm: Story = {
  ...reference,
  render: () =>
    html`<form
      style="display:grid;gap:12px;max-inline-size:320px"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const out = form.querySelector('output')!;
        out.textContent = `Submitted: ${JSON.stringify(Object.fromEntries(new FormData(form)))}`;
      }}
    >
      <prism-switch label="Auto-refresh" name="refresh" checked></prism-switch>
      <prism-switch
        label="Weekly summary"
        name="summary"
        value="weekly"
      ></prism-switch>
      <div style="display:flex;gap:8px">
        <prism-button>Save</prism-button>
        <prism-button type="reset" variant="outline">Reset</prism-button>
      </div>
      <output
        aria-live="polite"
        style="font:400 12px/16px var(--prism-font-family-mono);color:var(--prism-color-text-muted)"
      ></output>
    </form>`,
};

export const Playground: Story = {};
