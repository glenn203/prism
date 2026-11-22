import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  type: 'button' | 'submit' | 'reset';
  variant: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  disabled: boolean;
  pressed?: boolean;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/Button',
  component: 'prism-button',
  args: {
    label: 'Save',
    type: 'button',
    variant: 'primary',
    size: 'md',
    disabled: false,
    pressed: false,
  },
  argTypes: {
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'outline', 'destructive'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  render: ({ label, type, variant, size, disabled, pressed }) =>
    html`<prism-button
      type=${type}
      variant=${variant}
      size=${size}
      ?disabled=${disabled}
      .pressed=${pressed}
      >${label}</prism-button
    >`,
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = { ...reference };

export const Disabled: Story = { ...reference, args: { disabled: true } };

/**
 * A toggle: `pressed` sets aria-pressed and :state(pressed). A pressed toggle
 * shows the shared selected layer and an underlined label, so the state never
 * relies on colour alone.
 */
export const Toggle: Story = {
  ...reference,
  args: { label: 'Bold', pressed: true },
};

/** Sizes follow the density of the nearest [data-prism-density]. */
export const Sizes: Story = {
  ...reference,
  render: () =>
    html`<div style="display: flex; gap: 8px; align-items: center">
      <prism-button type="button" size="sm">Save</prism-button>
      <prism-button type="button" size="md">Save</prism-button>
      <prism-button type="button" size="lg">Save</prism-button>
    </div>`,
};

const VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'outline',
  'destructive',
] as const;

/** Each variant at rest, selected (a pressed toggle) and disabled. */
export const Variants: Story = {
  ...reference,
  render: () =>
    html`<div
      style="display: grid; grid-template-columns: repeat(3, max-content); gap: 12px; justify-items: start"
    >
      ${VARIANTS.map(
        (v) =>
          html`<prism-button variant=${v} type="button">${v}</prism-button>
            <prism-button variant=${v} type="button" pressed
              >${v} selected</prism-button
            >
            <prism-button variant=${v} type="button" disabled
              >${v} disabled</prism-button
            >`,
      )}
    </div>`,
};

export const Playground: Story = {};
