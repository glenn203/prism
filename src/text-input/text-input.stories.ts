import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../button/define.js';

interface Args {
  label: string;
  type: 'text' | 'email' | 'url' | 'tel';
  size: 'sm' | 'md' | 'lg';
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  floating: boolean;
  clearable: boolean;
  description: string;
  error: string;
}

const reference = { parameters: { controls: { disable: true } } };

/**
 * Single-line input for text, email, url and tel. `<prism-text-field>` is a
 * deprecated alias. Tag names are pending.
 */
const meta: Meta<Args> = {
  title: 'Components/Text input',
  component: 'prism-text-input',
  argTypes: {
    type: { control: 'inline-radio', options: ['text', 'email', 'url', 'tel'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  args: {
    label: 'Email',
    type: 'email',
    size: 'md',
    required: false,
    disabled: false,
    readonly: false,
    floating: false,
    clearable: false,
    description: 'We only use this for receipts.',
    error: 'Enter an email address.',
  },
  render: (a) => html`
    <prism-text-input
      label=${a.label}
      type=${a.type}
      size=${a.size}
      name="email"
      autocomplete="email"
      ?required=${a.required}
      ?disabled=${a.disabled}
      ?readonly=${a.readonly}
      ?floating=${a.floating}
      ?clearable=${a.clearable}
      style="max-inline-size: 320px"
    >
      <span slot="description">${a.description}</span>
      <span slot="error">${a.error}</span>
    </prism-text-input>
  `,
};
export default meta;
type S = StoryObj<Args>;

export const Default: S = { ...reference };
export const Required: S = { ...reference, args: { required: true } };
export const Disabled: S = { ...reference, args: { disabled: true } };
export const Readonly: S = { ...reference, args: { readonly: true } };

export const Sizes: S = {
  ...reference,
  render: () => html`
    <div style="display: grid; gap: 24px; max-inline-size: 320px">
      ${(['sm', 'md', 'lg'] as const).map(
        (s) =>
          html`<prism-text-input
            label="Size ${s}"
            size=${s}
            value="lumen@example.com"
          ></prism-text-input>`,
      )}
    </div>
  `,
};

/** Submit the form empty to see the attached error box. */
export const Invalid: S = {
  ...reference,
  args: { required: true },
  render: (a) => html`
    <form
      @submit=${(e: Event) => e.preventDefault()}
      style="display: grid; gap: 12px; max-inline-size: 320px"
    >
      <prism-text-input label=${a.label} type="email" name="email" required>
        <span slot="description">${a.description}</span>
        <span slot="error">${a.error}</span>
      </prism-text-input>
      <prism-button>Submit</prism-button>
    </form>
  `,
};

/**
 * The label rests inside the field and floats onto its top edge on focus or
 * with a value.
 */
export const FloatingLabel: S = {
  ...reference,
  args: { label: 'Email', description: 'We only use this for receipts.' },
  render: (a) => html`
    <div style="display: grid; gap: 28px; max-inline-size: 320px">
      <prism-text-input
        label=${a.label}
        type="email"
        floating
        clearable
        autocomplete="email"
      >
        <span slot="description">${a.description}</span>
      </prism-text-input>
      <prism-text-input
        label="Starts with a value"
        floating
        value="lumen@example.com"
      ></prism-text-input>
    </div>
  `,
};

/** A short prefix or suffix sits inside the field; the text keeps clear of both and of the clear button. */
export const PrefixSuffixClear: S = {
  ...reference,
  render: () => html`
    <div style="display: grid; gap: 28px; max-inline-size: 320px">
      <prism-text-input label="Focal length" floating clearable value="50">
        <span slot="suffix">mm</span>
        <span slot="description">The marked length of the lens.</span>
      </prism-text-input>
      <prism-text-input label="Plate" clearable value="lumen.example">
        <span slot="prefix">https://</span>
      </prism-text-input>
    </div>
  `,
};

export const Playground: S = {};
