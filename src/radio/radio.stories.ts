import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../button/define.js';

interface Args {
  label: string;
  value: string;
  disabled: boolean;
  required: boolean;
  orientation: 'vertical' | 'horizontal';
}

const meta: Meta<Args> = {
  title: 'Components/Radio',
  component: 'prism-radio-group',
  args: {
    label: 'Delivery speed',
    value: 'weekly',
    disabled: false,
    required: false,
    orientation: 'vertical',
  },
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['vertical', 'horizontal'],
    },
  },
  render: (a) =>
    html`<prism-radio-group
      label=${a.label}
      value=${a.value}
      orientation=${a.orientation}
      ?disabled=${a.disabled}
      ?required=${a.required}
    >
      <prism-radio value="daily" label="Daily"></prism-radio>
      <prism-radio value="weekly" label="Weekly"></prism-radio>
      <prism-radio value="monthly" label="Monthly"></prism-radio>
    </prism-radio-group>`,
};
export default meta;
type Story = StoryObj<Args>;

/**
 * Exactly one choice. Click a radio, or Tab to the group and use the arrow
 * keys: they move focus and pick together, wrapping round and skipping
 * disabled radios. Pressing squishes the circle a little. The new dot springs
 * in with a gentle overshoot while the old one shrinks out, started on the
 * same frame, in about 400ms. A pick in the middle of a move turns each dot
 * round from where it is.
 */
export const Default: Story = {};

/** Nothing picked yet. Tab lands on the first radio, and an arrow key picks. */
export const NoneSelected: Story = { args: { value: '' } };

/** Help text goes in the `description` slot on the group, and the `description` attribute on a radio. */
export const WithDescriptions: Story = {
  render: () =>
    html`<prism-radio-group label="Delivery speed" value="weekly">
      <span slot="description">You can change this any time.</span>
      <prism-radio
        value="daily"
        label="Daily"
        description="A short note every morning."
      ></prism-radio>
      <prism-radio
        value="weekly"
        label="Weekly"
        description="One note on Monday."
      ></prism-radio>
      <prism-radio
        value="monthly"
        label="Monthly"
        description="One long note on the first."
      ></prism-radio>
    </prism-radio-group>`,
};

/** The radios can sit in a row. */
export const Horizontal: Story = { args: { orientation: 'horizontal' } };

/** One radio disabled, and a whole group disabled. */
export const Disabled: Story = {
  render: () =>
    html`<div style="display:grid;gap:24px">
      <prism-radio-group label="One choice off" value="a">
        <prism-radio value="a" label="Open"></prism-radio>
        <prism-radio value="b" label="Closed" disabled></prism-radio>
      </prism-radio-group>
      <prism-radio-group label="Group off" value="a" disabled>
        <prism-radio value="a" label="Open"></prism-radio>
        <prism-radio value="b" label="Closed"></prism-radio>
      </prism-radio-group>
    </div>`,
};

/** Sizes, set on the group: sm (16px circle), md (20px) and lg (24px). All keep a 24px minimum target. */
export const Sizes: Story = {
  render: () =>
    html`<div style="display:grid;gap:24px">
      ${(['sm', 'md', 'lg'] as const).map(
        (size) =>
          html`<prism-radio-group
            label=${`Size ${size}`}
            value="a"
            size=${size}
            orientation="horizontal"
          >
            <prism-radio value="a" label="First"></prism-radio>
            <prism-radio value="b" label="Second"></prism-radio>
          </prism-radio-group>`,
      )}
    </div>`,
};

/**
 * Required, inside a form. The error appears once the group has been used
 * or the form is submitted, and goes when one is picked. The picked radio's
 * `value` is submitted under the group's `name`.
 */
export const InForm: Story = {
  render: () =>
    html`<form
      style="display:grid;gap:16px;max-inline-size:340px"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        form.querySelector('output')!.textContent =
          `Submitted: ${JSON.stringify(Object.fromEntries(new FormData(form)))}`;
      }}
    >
      <prism-radio-group label="Spectrum band" name="band" required>
        <span slot="error">Pick a band to continue.</span>
        <prism-radio value="violet" label="Violet"></prism-radio>
        <prism-radio value="cyan" label="Cyan"></prism-radio>
        <prism-radio value="amber" label="Amber"></prism-radio>
      </prism-radio-group>
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

/**
 * Under `prefers-reduced-motion: reduce` nothing squishes, grows or shrinks:
 * the pick changes at once and the colour fades over 120ms. Try it with your
 * system setting turned on. Forced colours use the system highlight.
 */
export const ReducedMotion: Story = {
  render: () =>
    html`<prism-radio-group label="Try me" value="a">
      <prism-radio value="a" label="First"></prism-radio>
      <prism-radio value="b" label="Second"></prism-radio>
    </prism-radio-group>`,
};
