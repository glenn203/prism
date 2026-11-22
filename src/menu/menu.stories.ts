import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';

interface Args {
  label: string;
  disabled: boolean;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/Menu',
  component: 'prism-menu',
  args: { label: 'More options for the field notes', disabled: false },
  render: ({ label, disabled }) =>
    html`<prism-menu label=${label} ?disabled=${disabled}>
      <prism-menu-item>Edit</prism-menu-item>
      <prism-menu-item>Duplicate</prism-menu-item>
      <prism-menu-item disabled>Archive (needs approval)</prism-menu-item>
    </prism-menu>`,
};
export default meta;
type Story = StoryObj<Args>;

/** Overflow menu. Name it after the item it belongs to. */
export const Default: Story = { ...reference };

export const Disabled: Story = { ...reference, args: { disabled: true } };

/**
 * Checkbox items: `checkable` (and `checked`) turn a row into a
 * menuitemcheckbox. Activating one flips it and the menu stays open.
 */
export const CheckableItems: Story = {
  ...reference,
  render: () =>
    html`<prism-menu label="View options">
      <prism-menu-item checkable checked>Show grid</prism-menu-item>
      <prism-menu-item checkable>Show rulers</prism-menu-item>
      <prism-menu-item checkable disabled>Show guides</prism-menu-item>
      <prism-menu-item>Reset view</prism-menu-item>
    </prism-menu>`,
};

export const Playground: Story = {};
