import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../tag/define.js';

interface Args {
  orientation: 'horizontal' | 'vertical';
}

const reference = { parameters: { controls: { disable: true } } };

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
      <prism-description-list label="Plate details" orientation=${orientation}>
        <prism-description-list-item label="Body"
          >Lumen Board 9</prism-description-list-item
        >
        <prism-description-list-item label="Lens"
          >50 mm prime</prism-description-list-item
        >
        <prism-description-list-item label="Aperture"
          >f/2.8</prism-description-list-item
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
export const Default: Story = { ...reference };

export const Vertical: Story = {
  ...reference,
  args: { orientation: 'vertical' },
};

export const Playground: Story = {};
