import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  length: 4 | 6 | 8;
  disabled: boolean;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/OTP input',
  component: 'prism-otp-input',
  args: { length: 6, disabled: false },
  argTypes: {
    length: { control: 'inline-radio', options: [4, 6, 8] },
  },
  render: ({ length, disabled }) =>
    html`<prism-otp-input
      length=${length}
      ?disabled=${disabled}
      @prism-otp-complete=${(e: CustomEvent<{ value: string }>) =>
        console.log('complete', e.detail.value)}
    ></prism-otp-input>`,
};
export default meta;
type Story = StoryObj<Args>;

/** Six digits, one group. The label is "Code". */
export const Default: Story = { ...reference };

export const FourDigits: Story = { ...reference, args: { length: 4 } };

export const Disabled: Story = { ...reference, args: { disabled: true } };

export const Playground: Story = {};
