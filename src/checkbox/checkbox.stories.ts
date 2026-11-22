import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../button/define.js';

interface Args {
  label: string;
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  required: boolean;
  size: 'sm' | 'md' | 'lg';
  hideLabel: boolean;
}

const meta: Meta<Args> = {
  title: 'Components/Checkbox',
  component: 'prism-checkbox',
  args: {
    label: 'Email me a weekly summary',
    checked: false,
    indeterminate: false,
    disabled: false,
    required: false,
    size: 'md',
    hideLabel: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  render: (a) =>
    html`<prism-checkbox
      label=${a.label}
      size=${a.size}
      ?checked=${a.checked}
      ?indeterminate=${a.indeterminate}
      ?disabled=${a.disabled}
      ?required=${a.required}
      ?hide-label=${a.hideLabel}
    ></prism-checkbox>`,
};
export default meta;

const reference = { parameters: { controls: { disable: true } } };
type Story = StoryObj<Args>;

/** A yes or no choice. Click it, or press Space when it has focus. */
export const Default: Story = { ...reference };

/** Starts checked. */
export const Checked: Story = { ...reference, args: { checked: true } };

/** Indeterminate is for a parent of a partly picked group. Click it to check the box. */
export const Indeterminate: Story = {
  ...reference,
  args: { indeterminate: true },
};

/** Every look side by side. */
export const States: Story = {
  ...reference,
  render: () =>
    html`<div style="display:grid;gap:12px">
      <prism-checkbox label="Off"></prism-checkbox>
      <prism-checkbox label="On" checked></prism-checkbox>
      <prism-checkbox label="Some" indeterminate></prism-checkbox>
      <prism-checkbox label="Off, disabled" disabled></prism-checkbox>
      <prism-checkbox label="On, disabled" checked disabled></prism-checkbox>
      <prism-checkbox
        label="Some, disabled"
        indeterminate
        disabled
      ></prism-checkbox>
    </div>`,
};

/** Sizes: sm (16px box), md (20px) and lg (24px). All keep a 24px minimum target. */
export const Sizes: Story = {
  ...reference,
  render: () =>
    html`<div style="display:grid;gap:12px">
      ${(['sm', 'md', 'lg'] as const).map(
        (s) =>
          html`<div style="display:flex;gap:24px;align-items:center">
            <prism-checkbox label="Size ${s}, off" size=${s}></prism-checkbox>
            <prism-checkbox
              label="Size ${s}, on"
              size=${s}
              checked
            ></prism-checkbox>
          </div>`,
      )}
    </div>`,
};

/** Help text goes in the `description` slot, under the label. */
export const WithDescription: Story = {
  ...reference,
  render: () =>
    html`<prism-checkbox label="Share my spectrum">
      <span slot="description">Anyone with the link can see your bands.</span>
    </prism-checkbox>`,
};

/**
 * The label can be hidden from sight when the row already says what the box
 * is for, as in a table. It still names the checkbox for screen readers.
 */
export const HiddenLabel: Story = {
  ...reference,
  render: () =>
    html`<div style="display:flex;gap:12px;align-items:center">
      <prism-checkbox label="Select prism A" hide-label></prism-checkbox>
      <span aria-hidden="true">Prism A</span>
    </div>`,
};

/**
 * Required, inside a form. The error appears once the box has been touched or
 * the form is submitted, and goes when the box is checked. While checked the
 * box submits its `value` under its `name`; unchecked it submits nothing.
 */
export const InForm: Story = {
  ...reference,
  render: () =>
    html`<form
      style="display:grid;gap:12px;max-inline-size:340px"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        form.querySelector('output')!.textContent =
          `Submitted: ${JSON.stringify(Object.fromEntries(new FormData(form)))}`;
      }}
    >
      <prism-checkbox
        label="Weekly summary"
        name="summary"
        value="weekly"
        checked
      ></prism-checkbox>
      <prism-checkbox label="I have read the notes" name="notes" required>
        <span slot="error">Tick this box to continue.</span>
      </prism-checkbox>
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
