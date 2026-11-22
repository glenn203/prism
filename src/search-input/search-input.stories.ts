import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/Search input',
  component: 'prism-search-input',
  args: {
    label: 'Search lenses',
    placeholder: 'Search lenses',
    value: '',
    disabled: false,
  },
  render: ({ label, placeholder, value, disabled }) =>
    html`<div style="max-inline-size: 320px">
      <prism-search-input
        name="q"
        label=${label}
        placeholder=${placeholder}
        value=${value}
        ?disabled=${disabled}
        @prism-search=${(e: CustomEvent<{ value: string }>) =>
          console.log('search', e.detail.value)}
      ></prism-search-input>
    </div>`,
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = { ...reference };

export const WithValue: Story = {
  ...reference,
  args: { value: '50 mm prime' },
};

export const Disabled: Story = { ...reference, args: { disabled: true } };

export const Playground: Story = {};
