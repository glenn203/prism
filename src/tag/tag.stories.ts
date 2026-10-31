import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import { iconRefresh } from '../internal/icons.js';

interface Args {
  text: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
  emphasis: 'high' | 'low' | 'ghost';
  size: 'sm' | 'md';
}

const TONES = ['neutral', 'info', 'success', 'warning', 'danger', 'accent'];

const meta: Meta<Args> = {
  title: 'Components/Tag',
  component: 'prism-tag',
  args: { text: 'Urgent', tone: 'danger', emphasis: 'low', size: 'md' },
  argTypes: {
    tone: { control: 'select', options: TONES },
    emphasis: { control: 'inline-radio', options: ['high', 'low', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
  render: ({ text, tone, emphasis, size }) =>
    html`<prism-tag tone=${tone} emphasis=${emphasis} size=${size}
      >${text}</prism-tag
    >`,
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

/** Six tones, three emphases. The word carries the meaning, not the colour. */
export const TonesAndEmphasis: Story = {
  render: () =>
    html`<div style="display:grid;gap:12px">
      ${['low', 'high', 'ghost'].map(
        (e) =>
          html`<div style="display:flex;gap:8px;flex-wrap:wrap">
            ${TONES.map(
              (t) => html`<prism-tag tone=${t} emphasis=${e}>${t}</prism-tag>`,
            )}
          </div>`,
      )}
    </div>`,
};

/** Jobs say what the word means. `job` has no colour of its own: pick the tone. */
export const Jobs: Story = {
  render: () =>
    html`<div style="display:flex;gap:8px;flex-wrap:wrap">
      <prism-tag job="spectrum" tone="danger" emphasis="high"
        >Spectrum</prism-tag
      >
      <prism-tag job="status">In progress</prism-tag>
      <prism-tag job="presence" tone="success">Added</prism-tag>
      <prism-tag job="clarity" tone="success">Clarity</prism-tag>
      <prism-tag job="illusionary" tone="danger">Illusionary</prism-tag>
      <prism-tag job="health" tone="warning">Needs update</prism-tag>
      <prism-tag job="refractive-rules" tone="success"
        >Refractive Rules</prism-tag
      >
      <prism-tag job="diffusion" tone="success">Diffusion</prism-tag>
      <prism-tag job="keyword">Refraction-7</prism-tag>
    </div>`,
};

export const Sizes: Story = {
  render: () =>
    html`<div style="display:flex;gap:8px;align-items:center">
      <prism-tag size="sm">Small, 20px</prism-tag>
      <prism-tag>Medium, 24px</prism-tag>
    </div>`,
};

/** An icon in front helps reading. It never replaces the word. */
export const WithIcon: Story = {
  render: () =>
    html`<prism-tag tone="info"
      ><span slot="icon" aria-hidden="true">${iconRefresh()}</span
      >Syncing</prism-tag
    >`,
};

/** Dismissible: an applied filter. The app removes it on the event. */
export const Dismissible: Story = {
  render: () =>
    html`<div
      style="display:flex;gap:8px"
      @prism-tag-remove=${(e: Event) => (e.target as HTMLElement).remove()}
    >
      <prism-tag dismissible job="keyword">Region</prism-tag>
      <prism-tag dismissible job="keyword" tone="danger">Lumen Bloom</prism-tag>
    </div>`,
};

/** Selectable: on or off, like a filter chip. `aria-pressed` and a solid border. Pressing shrinks it evenly by 3% and eases back (the remove button too). */
export const Selectable: Story = {
  render: () =>
    html`<div style="display:flex;gap:8px">
      <prism-tag selectable selected>Lumen OS</prism-tag>
      <prism-tag selectable>Spectra OS</prism-tag>
      <prism-tag selectable disabled>Aurora OS</prism-tag>
    </div>`,
};

/** Trigger: click opens a Select. It looks like any Tag, with a caret. */
export const Trigger: Story = {
  render: () => html`<prism-tag trigger job="status">In progress</prism-tag>`,
};
