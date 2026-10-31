import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  type: 'button' | 'submit' | 'reset';
  disabled: boolean;
  pressed?: boolean;
}

const meta: Meta<Args> = {
  title: 'Components/Button',
  component: 'prism-button',
  args: { label: 'Save', type: 'button', disabled: false },
  argTypes: {
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
  },
  render: ({ label, type, disabled, pressed }) =>
    html`<prism-button type=${type} ?disabled=${disabled} .pressed=${pressed}
      >${label}</prism-button
    >`,
};
export default meta;

export const Default: StoryObj<Args> = {};

export const Disabled: StoryObj<Args> = { args: { disabled: true } };

/**
 * A toggle: `pressed` sets aria-pressed and :state(pressed). A pressed toggle
 * shows the shared selected layer (11%, 15% under the pointer) and an
 * underlined label, so the state never relies on colour alone.
 */
export const Toggle: StoryObj<Args> = {
  args: { label: 'Bold', pressed: false },
};

/** Sizes follow the density of the nearest [data-prism-density]. */
export const Sizes: StoryObj<Args> = {
  render: ({ label }) =>
    html`<div style="display: flex; gap: 8px; align-items: center">
      <prism-button type="button" size="sm">${label}</prism-button>
      <prism-button type="button" size="md">${label}</prism-button>
      <prism-button type="button" size="lg">${label}</prism-button>
    </div>`,
};

/** Outline variant (name provisional). */
export const Outline: StoryObj = {
  render: () =>
    html`<div style="display: flex; gap: 12px">
      <prism-button variant="outline" type="button">Cancel</prism-button>
      <prism-button variant="outline" type="button" disabled
        >Unavailable</prism-button
      >
    </div>`,
};

const VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'outline',
  'destructive',
] as const;
const variantStory = (v: (typeof VARIANTS)[number]): StoryObj => ({
  render: () =>
    html`<div style="display: flex; gap: 12px">
      <prism-button variant=${v} type="button">${v}</prism-button>
      <prism-button variant=${v} type="button" pressed>Selected</prism-button>
      <prism-button variant=${v} type="button" disabled
        >Unavailable</prism-button
      >
    </div>`,
});
/** Variant names provisional, pending. Each shows rest, selected (a pressed toggle) and disabled. */
export const Primary = variantStory('primary');
export const Secondary = variantStory('secondary');
export const Ghost = variantStory('ghost');
export const Destructive = variantStory('destructive');
/** Every variant side by side: rest, selected (a pressed toggle) and disabled. Hover any button to see the 6% layer, or 15% on a selected one. */
export const AllVariants: StoryObj = {
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

/**
 * Press. The whole button shrinks evenly (never an uneven squish) on the shared
 * spring, by an amount that follows its size: small and icon buttons about 3%,
 * medium 2.5%, large 2%, and wide (over 240px) a notch less. Release eases
 * back to full size without passing it, settling in about 200ms; a new
 * press mid-return takes over from where it is. Enter and Space give a brief
 * press too. Reduced motion shows only the pressed colour. Wrap dense table
 * rows in `data-prism-still` to keep their controls still.
 */
export const Press: StoryObj = {
  render: () =>
    html`<div
      style="display:grid;gap:16px;justify-items:start;inline-size:420px"
    >
      <div style="display:flex;gap:12px;align-items:center">
        <prism-button size="sm">Small</prism-button>
        <prism-button>Medium</prism-button>
        <prism-button size="lg">Large</prism-button>
        <prism-icon-button label="Add item">+</prism-icon-button>
      </div>
      <prism-button size="lg" style="display:block;inline-size:100%"
        >Full width</prism-button
      >
      <div data-prism-still style="display:flex;gap:12px;align-items:center">
        <span>Dense row (still):</span>
        <prism-button size="sm" variant="outline">Edit</prism-button>
      </div>
    </div>`,
};
