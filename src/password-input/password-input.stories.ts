import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  autocomplete: 'current-password' | 'new-password';
  disabled: boolean;
  required: boolean;
  label: string;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/Password input',
  component: 'prism-password-input',
  args: {
    autocomplete: 'current-password',
    disabled: false,
    required: false,
    label: 'Password',
  },
  argTypes: {
    autocomplete: {
      control: 'inline-radio',
      options: ['current-password', 'new-password'],
    },
  },
  render: ({ autocomplete, disabled, required, label }) =>
    html`<form
      style="max-inline-size: 320px; display: grid; gap: 16px"
      @submit=${(e: Event) => e.preventDefault()}
    >
      <prism-password-input
        name="password"
        label=${label}
        autocomplete=${autocomplete}
        ?disabled=${disabled}
        ?required=${required}
      >
        <span slot="error">Enter a password.</span>
      </prism-password-input>
    </form>`,
};
export default meta;
type Story = StoryObj<Args>;

/** Sign in. The label and tooltip stay "Show password" / "Hide password". */
export const Default: Story = { ...reference };

/**
 * A new password. Show helps people check their typo; a confirmation field
 * is a second check, not a substitute.
 */
export const NewPassword: Story = {
  ...reference,
  args: { autocomplete: 'new-password' },
};

export const Disabled: Story = { ...reference, args: { disabled: true } };

/** The MessageBox appears after the field is reported invalid. */
export const Invalid: Story = {
  ...reference,
  args: { required: true },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('prism-password-input')!;
    await el.updateComplete;
    el.reportValidity();
  },
};

export const Playground: Story = {};
