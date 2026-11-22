import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import { iconMore, iconRefresh, iconX } from '../internal/icons.js';

interface Args {
  label: string;
  size: 'sm' | 'md' | 'lg';
  disabled: boolean;
}

const meta: Meta<Args> = {
  title: 'Components/Icon button',
  component: 'prism-icon-button',
  args: { label: 'Refresh', size: 'md', disabled: false },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  render: ({ label, size, disabled }) =>
    html`<prism-icon-button label=${label} size=${size} ?disabled=${disabled}
      >${iconRefresh()}</prism-icon-button
    >`,
};
export default meta;

const reference = { parameters: { controls: { disable: true } } };

export const Default: StoryObj<Args> = { ...reference };
export const Disabled: StoryObj<Args> = {
  ...reference,
  args: { disabled: true },
};

/** Square at the control height; follows density. */
export const Sizes: StoryObj<Args> = {
  ...reference,
  render: () =>
    html`<div style="display:flex;gap:8px;align-items:center">
      <prism-icon-button label="Close" size="sm">${iconX()}</prism-icon-button>
      <prism-icon-button label="Refresh">${iconRefresh()}</prism-icon-button>
      <prism-icon-button label="More" size="lg"
        >${iconMore()}</prism-icon-button
      >
    </div>`,
};

export const Playground: StoryObj<Args> = {};
