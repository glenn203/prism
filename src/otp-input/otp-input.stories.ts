import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  length: number;
  required: boolean;
  disabled: boolean;
}

/**
 * One-time code: one real input (autocomplete="one-time-code") drawn as boxes.
 * Paste fills every box; `prism-otp-complete` fires when full. Name pending Technical
 * Writer.
 */
const meta: Meta<Args> = {
  title: 'Components/OTP input',
  component: 'prism-otp-input',
  args: {
    label: 'Verification code',
    length: 6,
    required: true,
    disabled: false,
  },
  render: (a) => html`
    <prism-otp-input
      label=${a.label}
      length=${a.length}
      name="otp"
      ?required=${a.required}
      ?disabled=${a.disabled}
      @prism-otp-complete=${(e: CustomEvent<{ value: string }>) =>
        console.log('prism-otp-complete', e.detail.value)}
    >
      <span slot="description">Sent to •••• 1234.</span>
      <span slot="error">Enter the ${a.length}-digit code.</span>
    </prism-otp-input>
  `,
};
export default meta;
type S = StoryObj<Args>;
export const Default: S = {};
export const FourDigits: S = { args: { length: 4 } };
export const Disabled: S = { args: { disabled: true } };
