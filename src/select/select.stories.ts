import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  size: 'sm' | 'md' | 'lg';
  disabled: boolean;
  required: boolean;
  description: string;
  error: string;
}

const options = html`
  <prism-option value="apricot">Apricot</prism-option>
  <prism-option value="banana">Banana</prism-option>
  <prism-option value="cherry">Cherry</prism-option>
  <prism-option value="durian" disabled>Durian (sold out)</prism-option>
  <prism-option value="elderberry">Elderberry</prism-option>
`;

const meta: Meta<Args> = {
  title: 'Components/Select',
  component: 'prism-select',
  args: {
    label: 'Fruit',
    size: 'md',
    disabled: false,
    required: false,
    description: '',
    error: 'Choose a fruit.',
  },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  render: ({ label, size, disabled, required, description, error }) => html`
    <div style="max-inline-size: 320px">
      <prism-select
        label=${label}
        name="fruit"
        placeholder="Select a fruit"
        size=${size}
        ?disabled=${disabled}
        ?required=${required}
      >
        ${options}
        ${
          description
            ? html`<span slot="description">${description}</span>`
            : ''
        }
        <span slot="error">${error}</span>
      </prism-select>
    </div>
  `,
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: 24px; max-inline-size: 320px">
      ${(['sm', 'md', 'lg'] as const).map(
        (s) =>
          html`<prism-select label="Size ${s}" size=${s} value="apricot"
            >${options}</prism-select
          >`,
      )}
    </div>
  `,
};

export const Densities: Story = {
  render: () => html`
    <div style="display: grid; gap: 24px; max-inline-size: 320px">
      ${(['compact', 'default', 'comfortable'] as const).map(
        (d) =>
          html`<div data-prism-density=${d}>
            <prism-select label="Density ${d}" value="banana"
              >${options}</prism-select
            >
          </div>`,
      )}
    </div>
  `,
};

export const Disabled: Story = { args: { disabled: true } };

export const WithHelper: Story = {
  args: { description: 'We ship fruit on Mondays.' },
};

/** Flat attached error box (same as text field) animates in and replaces the helper text. Tab in to see the shared outer focus ring. */
export const ErrorState: Story = {
  args: { required: true, description: 'We ship fruit on Mondays.' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('prism-select')!;
    await el.updateComplete;
    el.reportValidity();
  },
};

/** The open popup overlays the helper text below the control. */
export const OpenMenuWithHelper: Story = {
  args: { description: 'We ship fruit on Mondays.' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('prism-select')!;
    await el.updateComplete;
    el.showPicker();
  },
};

/**
 * The popup grows out of the trigger and the chevron turns over. The keys,
 * type-ahead and the checked option's mark are the browser's own.
 */
export const Motion: Story = {
  args: { label: 'Fruit' },
  render: ({ label }) => html`
    <div style="max-inline-size: 320px; min-block-size: 320px">
      <prism-select label=${label} value="banana" placeholder="Select a fruit">
        ${options}
      </prism-select>
    </div>
  `,
};

/** Many options: the popup scrolls and keeps the chosen option in view. */
export const LongList: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; min-block-size: 360px">
      <prism-select label="Colour" value="c07">
        ${Array.from(
          { length: 40 },
          (_, i) =>
            html`<prism-option value="c${String(i).padStart(2, '0')}"
              >Colour ${i + 1}</prism-option
            >`,
        )}
      </prism-select>
    </div>
  `,
};
