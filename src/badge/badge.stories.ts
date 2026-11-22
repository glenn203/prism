import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../button/define.js';

interface Args {
  count: number;
  max: number;
  showZero: boolean;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/Badge',
  component: 'prism-badge',
  args: { count: 48, max: 99, showZero: false },
  render: ({ count, max, showZero }) =>
    html`<prism-button variant="ghost"
      >Updates
      <prism-badge
        count=${count}
        max=${max}
        ?show-zero=${showZero}
      ></prism-badge
    ></prism-button>`,
};
export default meta;
type Story = StoryObj<Args>;

/** A count sits inside the control it counts, so it reads "Updates 48". */
export const Default: Story = { ...reference };

/** Above the cap it reads 99+. Zero is hidden unless `show-zero`. */
export const CountCap: Story = {
  ...reference,
  render: () =>
    html`<div style="display:flex;gap:16px;align-items:center">
      <prism-badge count="7"></prism-badge>
      <prism-badge count="128"></prism-badge>
      <prism-badge count="0" show-zero></prism-badge>
      <prism-badge count="0"></prism-badge>
      <span>(the last one is hidden)</span>
    </div>`,
};

/** Process status: Live, Running, Stopped. The word is always there. */
export const Status: Story = {
  ...reference,
  render: () =>
    html`<div style="display:flex;gap:8px">
      <prism-badge job="status" status="live"></prism-badge>
      <prism-badge job="status" status="running"></prism-badge>
      <prism-badge job="status" status="stopped"></prism-badge>
    </div>`,
};

export const Playground: Story = {};
