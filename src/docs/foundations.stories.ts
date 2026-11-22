import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';

const meta: Meta = {
  title: 'Foundations/Tokens',
  tags: ['!autodocs'],
  parameters: { a11y: { test: 'off' } },
};
export default meta;

const read = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const styles = html`<style>
  .f-grid {
    display: grid;
    gap: var(--prism-space-4);
    font-family: var(--prism-font-family-sans);
    color: var(--prism-color-text);
  }
  .f-ramp {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: var(--prism-space-3);
  }
  .f-sw {
    border: var(--prism-border-width) solid var(--prism-color-border);
    border-radius: var(--prism-radius-5);
    overflow: hidden;
    background: var(--prism-color-bg);
  }
  .f-chip {
    block-size: 64px;
  }
  .f-meta {
    padding: var(--prism-space-2);
    font: var(--prism-text-caption-font-weight)
      var(--prism-text-caption-font-size) /
      var(--prism-text-caption-line-height) var(--prism-font-family-mono);
  }
  .f-meta b {
    display: block;
    font-family: var(--prism-font-family-sans);
    font-weight: 600;
  }
  .f-row {
    display: flex;
    align-items: center;
    gap: var(--prism-space-4);
    font-family: var(--prism-font-family-mono);
    font-size: var(--prism-font-size-12);
  }
  .f-bar {
    block-size: var(--prism-space-4);
    background: var(--prism-color-accent);
    border-radius: var(--prism-radius-1);
  }
  .f-box {
    inline-size: 64px;
    block-size: 64px;
    background: var(--prism-color-surface);
    border: var(--prism-border-width) solid var(--prism-color-border-strong);
  }
  h3.f-h {
    margin: var(--prism-space-6) 0 var(--prism-space-2);
    font-size: var(--prism-font-size-16);
  }
  .f-muted {
    color: var(--prism-color-text-muted);
  }
</style>`;

const swatchVar = (cssVar: string, name: string) => {
  return html`<div class="f-sw">
    <div class="f-chip" style="background: var(${cssVar})"></div>
    <div class="f-meta"><b>${name}</b>${read(cssVar)}</div>
  </div>`;
};
const swatch = (name: string) => swatchVar(`--prism-color-${name}`, name);

const NEUTRAL_STEPS = [
  '0',
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
];

const ramps = {
  red: ['50', '100', '300', '500', '600', '700', '800', '900'],
  ...Object.fromEntries(
    ['violet', 'blue', 'cyan', 'green', 'amber', 'magenta'].map((h) => [
      h,
      ['50', '100', '300', '500', '600', '700', '900'],
    ]),
  ),
};
const semantic = [
  'bg',
  'surface',
  'text',
  'text-muted',
  'border',
  'border-strong',
  'border-popup',
  'accent',
  'on-accent',
  'accent-text',
  'accent-surface',
  'on-solid',
  'neutral',
  'info',
  'info-text',
  'info-surface',
  'success',
  'success-text',
  'success-surface',
  'warning',
  'warning-text',
  'warning-surface',
  'danger',
  'danger-text',
  'danger-surface',
  'focus-ring',
  'focus-halo',
  'error',
  'error-text',
  'error-surface',
  'on-error-surface',
  'shadow',
  'shadow-urgent',
  // Fallback-only (no color-mix()); components use the shared state layer.
  'accent-hover',
  'accent-active',
  'surface-hover',
  'surface-pressed',
];

export const Color: StoryObj = {
  render: () =>
    html`${styles}
      <div class="f-grid">
        <p class="f-muted">
          Use the semantic names in components and themes. Ramps exist to feed
          them. See Foundations / Color for the full palette, the light and dark
          themes and the contrast table.
        </p>
        <h3 class="f-h">Semantic</h3>
        <div class="f-ramp">${semantic.map(swatch)}</div>
        <h3 class="f-h">neutral</h3>
        <div class="f-ramp">
          ${NEUTRAL_STEPS.map((s) => swatchVar(`--prism-neutral-${s}`, `neutral-${s}`))}
        </div>
        ${Object.entries(ramps).map(
          ([ramp, steps]) =>
            html`<h3 class="f-h">${ramp}</h3>
              <div class="f-ramp">
                ${steps.map((s) => swatch(`${ramp}-${s}`))}
              </div>`,
        )}
      </div>`,
};

export const Spacing: StoryObj = {
  render: () =>
    html`${styles}
      <div class="f-grid">
        <p class="f-muted">space-N = N × 4px. Fixed across density modes.</p>
        ${[0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map(
          (n) =>
            html`<div class="f-row">
              <span style="inline-size: 120px">--prism-space-${n}</span
              ><span style="inline-size: 48px">${n * 4}px</span>
              <div
                class="f-bar"
                style="inline-size: var(--prism-space-${n})"
              ></div>
            </div>`,
        )}
      </div>`,
};

export const Radius: StoryObj = {
  render: () =>
    html`${styles}
      <div class="f-row" style="flex-wrap: wrap">
        ${['none', '1', '3', '5', '7', '9', '11', 'full'].map(
          (r) =>
            html`<div
              style="display: grid; gap: var(--prism-space-2); justify-items: center"
            >
              <div
                class="f-box"
                style="border-radius: var(--prism-radius-${r})"
              ></div>
              <span>radius-${r}</span>
            </div>`,
        )}
      </div>`,
};

const roles = [
  'heading-1',
  'heading-2',
  'heading-3',
  'body-lg',
  'body',
  'label',
  'caption',
  'code',
];
export const Typography: StoryObj = {
  render: () =>
    html`${styles}
      <div class="f-grid">
        ${roles.map(
          (r) =>
            html`<div class="f-row" style="align-items: baseline">
              <span style="inline-size: 160px">--prism-text-${r}-*</span>
              <span
                style="font-family: var(--prism-text-${r}-font-family); font-size: var(--prism-text-${r}-font-size); line-height: var(--prism-text-${r}-line-height); font-weight: var(--prism-text-${r}-font-weight); color: var(--prism-color-text)"
                >The quick brown fox jumps over the lazy dog</span
              >
            </div>`,
        )}
      </div>`,
};

/** Tab through: the ring grows in over --prism-duration-default on --prism-ease-spring. */
export const Focus: StoryObj = {
  parameters: { a11y: { test: 'error' } },
  render: () =>
    html`${styles}
      <div class="f-grid" style="max-inline-size: 360px">
        <p class="f-muted">
          Press Tab. Ring = ${read('--prism-focus-ring-width')} at
          ${read('--prism-focus-ring-offset')} offset with a
          ${read('--prism-focus-ring-blur')} blur. Instant with reduced motion.
        </p>
        <prism-button type="button">Focus me</prism-button>
        <prism-text-input label="Or me"></prism-text-input>
      </div>`,
};

/** Shared elevation: one scale for menus, popovers, dialogs and status boxes. */
export const Elevation: StoryObj = {
  render: () =>
    html`${styles}
      <div class="f-grid" style="gap: 32px; padding: 16px">
        ${(
          [
            ['default', 'Resting raised surface: open menu, popover, dialog'],
            ['hover', 'Interactive item on hover or press'],
            ['urgent', 'Error-urgent: attached field status (red-tinted)'],
          ] as const
        ).map(
          ([level, use]) =>
            html`<div class="f-row">
              <div
                style="inline-size: 120px; block-size: 64px; border-radius: var(--prism-radius-7); background: var(--prism-color-bg); box-shadow: var(--prism-elevation-${level})"
              ></div>
              <span
                >--prism-elevation-${level}<br /><span class="f-muted"
                  >${use}</span
                ></span
              >
            </div>`,
        )}
      </div>`,
};
