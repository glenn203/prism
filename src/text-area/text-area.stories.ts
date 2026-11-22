import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  resize: 'vertical' | 'none';
  rows: number;
  autosize: boolean;
  counter: boolean;
  disabled: boolean;
  required: boolean;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/Text area',
  component: 'prism-text-area',
  args: {
    label: 'Notes',
    resize: 'vertical',
    rows: 3,
    autosize: false,
    counter: false,
    disabled: false,
    required: false,
  },
  argTypes: {
    resize: { control: 'inline-radio', options: ['vertical', 'none'] },
  },
  render: ({ label, resize, rows, autosize, counter, disabled, required }) =>
    html`<div style="max-inline-size: 360px">
      <prism-text-area
        name="notes"
        label=${label}
        resize=${resize}
        rows=${rows}
        ?autosize=${autosize}
        ?counter=${counter}
        ?disabled=${disabled}
        ?required=${required}
      >
        <span slot="error">Enter notes.</span>
      </prism-text-area>
    </div>`,
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = { ...reference };

export const Fixed: Story = { ...reference, args: { resize: 'none' } };

export const Disabled: Story = { ...reference, args: { disabled: true } };

/** The attached error box appears after the field is reported invalid. */
export const Invalid: Story = {
  ...reference,
  args: { required: true },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('prism-text-area')!;
    await el.updateComplete;
    el.reportValidity();
  },
};

export const Playground: Story = {};
