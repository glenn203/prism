import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../button/define.js';

interface Args {
  label: string;
  checked: boolean;
  disabled: boolean;
  size: 'sm' | 'md' | 'lg';
  hideLabel: boolean;
}

const meta: Meta<Args> = {
  title: 'Components/Switch',
  component: 'prism-switch',
  args: {
    label: 'Auto-refresh',
    checked: false,
    disabled: false,
    size: 'md',
    hideLabel: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  render: ({ label, checked, disabled, size, hideLabel }) =>
    html`<prism-switch
      label=${label}
      size=${size}
      ?checked=${checked}
      ?disabled=${disabled}
      ?hide-label=${hideLabel}
    ></prism-switch>`,
};
export default meta;
type Story = StoryObj<Args>;

/**
 * An on/off control that takes effect right away. A native checkbox with the
 * `switch` attribute, labelled only by its `<label for>`. Click it, or press
 * Space when it has focus. The default is still: a flat track and pill thumb,
 * no shadow and no gradient. Stretch, glint, press-grow, springs and drag
 * play when polish motion is on: press and hold widens the thumb; drag it past
 * the middle (or flick it) to turn the switch. The thumb's leading edge runs
 * ahead and the trailing edge follows, so it stretches about 28% mid-travel
 * and settles with a slight overshoot, in about 400ms either way. The accent
 * spreads from the thumb and the colours follow it on the same clock, and a
 * second tap mid-move turns it round from where it is.
 */
export const Default: Story = {};

/** Starts on. The thumb sits at the end, and the track is filled. */
export const On: Story = { args: { checked: true } };

/** Disabled keeps its position: the thumb still says on or off. */
export const Disabled: Story = {
  render: () =>
    html`<div style="display:grid;gap:12px">
      <prism-switch label="Sync over mobile data" disabled></prism-switch>
      <prism-switch label="Share usage notes" checked disabled></prism-switch>
    </div>`,
};

/** Sizes: sm (24px tall), md (28px) and lg (32px). All keep a 24px minimum target. */
export const Sizes: Story = {
  render: () =>
    html`<div style="display:grid;gap:12px">
      ${(['sm', 'md', 'lg'] as const).map(
        (s) =>
          html`<div style="display:flex;gap:24px;align-items:center">
            <prism-switch label="Size ${s}, off" size=${s}></prism-switch>
            <prism-switch
              label="Size ${s}, on"
              size=${s}
              checked
            ></prism-switch>
          </div>`,
      )}
    </div>`,
};

/** All four looks side by side, so you can compare off, on and disabled. */
export const States: Story = {
  render: () =>
    html`<div style="display:grid;gap:12px">
      <prism-switch label="Off"></prism-switch>
      <prism-switch label="On" checked></prism-switch>
      <prism-switch label="Off, disabled" disabled></prism-switch>
      <prism-switch label="On, disabled" checked disabled></prism-switch>
    </div>`,
};

/**
 * The label can be hidden from sight when another word on the page already
 * names the setting. It still names the switch for screen readers.
 */
export const HiddenLabel: Story = {
  render: () =>
    html`<div style="display:flex;gap:12px;align-items:center">
      <span aria-hidden="true">Dark preview</span>
      <prism-switch label="Dark preview" hide-label></prism-switch>
    </div>`,
};

/**
 * A settings list. Each switch applies the moment it is flipped, so there is
 * no Save button. `label-position="start"` puts the label first, and a block
 * host pushes the switch to the far end of the row.
 */
export const SettingsList: Story = {
  render: () =>
    html`<ul
      style="list-style:none;margin:0;padding:0;display:grid;gap:4px;max-inline-size:360px"
    >
      ${[
        ['Auto-refresh', true],
        ['Reduce glare after dusk', false],
        ['Show spectrum bands', true],
      ].map(
        ([label, on]) =>
          html`<li
            style="padding:8px 0;border-block-end:1px solid var(--prism-color-border)"
          >
            <prism-switch
              label=${label as string}
              label-position="start"
              style="display:block"
              ?checked=${on as boolean}
            ></prism-switch>
          </li>`,
      )}
    </ul>`,
};

/**
 * Inside a form. While on, the switch submits its `value` (default "on")
 * under its `name`. While off it submits nothing. Reset puts it back to how it
 * started.
 */
export const InForm: Story = {
  render: () =>
    html`<form
      style="display:grid;gap:12px;max-inline-size:320px"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const out = form.querySelector('output')!;
        out.textContent = `Submitted: ${JSON.stringify(Object.fromEntries(new FormData(form)))}`;
      }}
    >
      <prism-switch label="Auto-refresh" name="refresh" checked></prism-switch>
      <prism-switch
        label="Weekly summary"
        name="summary"
        value="weekly"
      ></prism-switch>
      <div style="display:flex;gap:8px">
        <prism-button>Save</prism-button>
        <prism-button type="reset" variant="outline">Reset</prism-button>
      </div>
      <output
        aria-live="polite"
        style="font:400 12px/16px var(--prism-font-family-mono);color:var(--prism-color-text-muted)"
      ></output>
    </form>`,
};

/**
 * Under `prefers-reduced-motion: reduce` there is no slide, stretch or spread:
 * the thumb jumps and the colours change over 120ms. Try it with your system setting turned on.
 */
export const ReducedMotion: Story = {
  render: () => html`<prism-switch label="Flip me"></prism-switch>`,
};
