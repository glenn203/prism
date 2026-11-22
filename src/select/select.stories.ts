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

const reference = { parameters: { controls: { disable: true } } };

const options = html`
  <prism-option value="24">24 mm</prism-option>
  <prism-option value="35">35 mm</prism-option>
  <prism-option value="50">50 mm</prism-option>
  <prism-option value="85" disabled>85 mm (on loan)</prism-option>
  <prism-option value="135">135 mm</prism-option>
`;

const meta: Meta<Args> = {
  title: 'Components/Select',
  component: 'prism-select',
  args: {
    label: 'Focal length',
    size: 'md',
    disabled: false,
    required: false,
    description: '',
    error: 'Choose a focal length.',
  },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  render: ({ label, size, disabled, required, description, error }) => html`
    <div style="max-inline-size: 320px">
      <prism-select
        label=${label}
        name="focal-length"
        placeholder="Select a focal length"
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

export const Default: Story = { ...reference };

export const Sizes: Story = {
  ...reference,
  render: () => html`
    <div style="display: grid; gap: 24px; max-inline-size: 320px">
      ${(['sm', 'md', 'lg'] as const).map(
        (s) =>
          html`<prism-select label="Size ${s}" size=${s} value="50"
            >${options}</prism-select
          >`,
      )}
    </div>
  `,
};

export const Disabled: Story = { ...reference, args: { disabled: true } };

export const WithHelper: Story = {
  ...reference,
  args: { description: 'Marked length of the mounted lens.' },
};

/** The attached error box appears after the field is reported invalid. */
export const ErrorState: Story = {
  ...reference,
  args: { required: true, description: 'Marked length of the mounted lens.' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('prism-select')!;
    await el.updateComplete;
    el.reportValidity();
  },
};

export const Playground: Story = {};
