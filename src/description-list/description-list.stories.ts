import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../tag/define.js';

interface Args {
  orientation: 'horizontal' | 'vertical';
}

const meta: Meta<Args> = {
  title: 'Components/Description list',
  component: 'prism-description-list',
  args: { orientation: 'horizontal' },
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
  },
  render: ({ orientation }) =>
    html`<div style="max-inline-size:360px">
      <prism-description-list
        label="Resource details"
        orientation=${orientation}
      >
        <prism-description-list-item label="OS"
          >Lumen Board 9</prism-description-list-item
        >
        <prism-description-list-item label="Version"
          >7.14.2</prism-description-list-item
        >
        <prism-description-list-item label="IP address"
          >192.0.2.42</prism-description-list-item
        >
        <prism-description-list-item label="Health"
          ><prism-tag job="health" tone="success"
            >Online</prism-tag
          ></prism-description-list-item
        >
      </prism-description-list>
    </div>`,
};
export default meta;
type Story = StoryObj<Args>;

/** Labels line up in one column across rows. */
export const Default: Story = {};

export const Vertical: Story = { args: { orientation: 'vertical' } };
