import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  size: 'sm' | 'md' | 'lg';
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
  showLabel: boolean;
}

const TONES = ['accent', 'neutral', 'info', 'success', 'warning', 'danger'];

const meta: Meta<Args> = {
  title: 'Components/Running indicator',
  component: 'prism-running-indicator',
  args: { label: 'Running', size: 'md', tone: 'accent', showLabel: true },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    tone: { control: 'select', options: TONES },
  },
  render: ({ label, size, tone, showLabel }) =>
    html`<prism-running-indicator
      label=${label}
      size=${size}
      tone=${tone}
      ?show-label=${showLabel}
    ></prism-running-indicator>`,
};
export default meta;

const reference = { parameters: { controls: { disable: true } } };
type Story = StoryObj<Args>;

/**
 * A solid dot that breathes, with one ring that spreads out of it and fades.
 * It says "this is running now". It is a status region, so screen readers get
 * the label. One pulse takes 1.92s and is followed by an 800ms rest, so the
 * whole cycle is 2.72s. In the rest the ring is gone and the dot is still.
 */
export const Default: Story = { ...reference };

/** The label is always in the page for screen readers. `show-label` also shows it. */
export const ScreenReaderOnly: Story = {
  ...reference,
  args: { label: 'Export running', showLabel: false },
};

/** Sizes: sm 16px (fits a card header), md 24px, lg 40px. */
export const Sizes: Story = {
  ...reference,
  render: () =>
    html`<div style="display:flex;gap:32px;align-items:center">
      ${(['sm', 'md', 'lg'] as const).map(
        (s) =>
          html`<prism-running-indicator
            size=${s}
            label="Size ${s}"
            show-label
          ></prism-running-indicator>`,
      )}
    </div>`,
};

/** The tone colours the dot and the ring together. Use success for "online", accent for a running job. */
export const Tones: Story = {
  ...reference,
  render: () =>
    html`<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
      ${TONES.map(
        (t) =>
          html`<prism-running-indicator
            tone=${t}
            size="lg"
            label=${t}
            show-label
          ></prism-running-indicator>`,
      )}
    </div>`,
};

export const Playground: Story = {};
