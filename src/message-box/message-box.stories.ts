import type { Meta, StoryObj } from '@storybook/web-components';
import { html, nothing } from 'lit';
import './define.js';
import '../text-input/define.js';

interface Args {
  intent: 'error' | 'info';
  placement: 'top' | 'bottom';
  announce: 'polite' | 'assertive' | 'off';
  message: string;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/MessageBox',
  component: 'prism-message-box',
  args: {
    intent: 'error',
    placement: 'bottom',
    announce: 'polite',
    message: 'Enter a focal length.',
  },
  argTypes: {
    intent: { control: 'inline-radio', options: ['error', 'info'] },
    placement: { control: 'inline-radio', options: ['top', 'bottom'] },
    announce: {
      control: 'inline-radio',
      options: ['polite', 'assertive', 'off'],
    },
  },
  render: ({ intent, placement, announce, message }) => html`
    <div style="max-inline-size: 20rem">
      ${
        placement === 'top'
          ? html`<prism-message-box
              intent=${intent}
              placement=${placement}
              announce=${announce}
              >${message}</prism-message-box
            >`
          : nothing
      }
      <div
        style="padding: 0.75rem; border: 1px solid var(--prism-color-border-strong); border-radius: 5px"
      >
        Optical plate
      </div>
      ${
        placement === 'bottom'
          ? html`<prism-message-box
              intent=${intent}
              placement=${placement}
              announce=${announce}
              >${message}</prism-message-box
            >`
          : nothing
      }
    </div>
  `,
};
export default meta;
type Story = StoryObj<Args>;

/** After the neighbor, in the error colours. */
export const Default: Story = { ...reference };

/** `top` goes before the neighbor in the DOM; `bottom` goes after. */
export const Placement: Story = {
  ...reference,
  render: () => html`
    <div style="display:grid;gap:24px;max-inline-size:20rem">
      <div>
        <prism-message-box placement="top" intent="error"
          >Aperture is wide.</prism-message-box
        >
        <div
          style="padding:0.75rem;border:1px solid var(--prism-color-border-strong);border-radius:5px"
        >
          Optical plate
        </div>
      </div>
      <div>
        <div
          style="padding:0.75rem;border:1px solid var(--prism-color-border-strong);border-radius:5px"
        >
          Optical plate
        </div>
        <prism-message-box placement="bottom" intent="error"
          >Focus is soft.</prism-message-box
        >
      </div>
    </div>
  `,
};

/** Error uses the error surface. Info uses the neutral tint and info tokens. */
export const Intent: Story = {
  ...reference,
  render: () => html`
    <div style="display:grid;gap:24px;max-inline-size:20rem">
      <div>
        <div
          style="padding:0.75rem;border:1px solid var(--prism-color-border-strong);border-radius:5px"
        >
          Optical plate
        </div>
        <prism-message-box intent="error">Out of focus.</prism-message-box>
      </div>
      <div>
        <div
          style="padding:0.75rem;border:1px solid var(--prism-color-border-strong);border-radius:5px"
        >
          Optical plate
        </div>
        <prism-message-box intent="info"
          >The refractive index is 1.52.</prism-message-box
        >
      </div>
    </div>
  `,
};

/** Fields render the box in their own shadow and leave announce off. */
export const InAField: Story = {
  ...reference,
  render: () => html`
    <div style="max-inline-size:20rem">
      <prism-text-input id="focal" label="Focal length" required value="">
        <span slot="error">Enter a focal length.</span>
      </prism-text-input>
    </div>
  `,
  play: ({ canvasElement }) => {
    const field = canvasElement.querySelector('prism-text-input');
    (field as HTMLInputElement | null)?.checkValidity();
  },
};

export const Playground: Story = {};
