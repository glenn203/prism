import type { Meta, StoryObj } from '@storybook/web-components';
import { html, type TemplateResult } from 'lit';
import '../define.js';

/**
 * Polish is an opt-in layer of four small effects. Load
 * `prism/polish.css` after `prism/theme.css`, call `enablePolish()` from
 * `prism/polish` once, and set `data-prism-polish` on `<html>` or on any
 * section. With no attribute, nothing changes.
 *
 * ```html
 * <html data-prism-polish>                 <!-- all four -->
 * <section data-prism-polish="squircle">   <!-- one (or several, separated by spaces) -->
 * <section data-prism-polish="off">        <!-- off again inside an "on" page -->
 * ```
 *
 * Use the **Polish** control in the toolbar above to switch it for every story.
 * The pages below set their own scope, so they look the same whatever the toolbar says.
 *
 * ## The four effects
 *
 * 1. **Squircle corners** (`squircle`). `corner-shape: squircle` behind the
 *    `--prism-corner-shape` token, on cards, buttons, tags, text inputs and menus.
 *    Where the browser has no `corner-shape`, the ordinary rounded corner stays.
 *    A squircle looks tighter than a circular corner, so the radius is multiplied
 *    by `--prism-corner-scale` (1.5) only where the shape is supported.
 * 2. **Light-following border** (`light`). On hover and on keyboard focus, a thin
 *    violet, blue and cyan ring is drawn over the border of buttons and interactive
 *    (or raised) cards. Its highlight sits under the pointer. The control's own
 *    border, focus ring and hover tint are untouched, so contrast and focus
 *    visibility do not change. It is off on touch screens. Under reduced motion it
 *    is a still ring that appears without fading.
 * 3. **Card tilt** (`tilt`). Cards lean toward the pointer by at most 2.5 degrees
 *    (`--prism-tilt-max`) in 900px of perspective, and ease back when it leaves.
 *    Transform only, one update per animation frame. Cards only, never buttons. Off
 *    on touch screens and under reduced motion.
 * 4. **Motion** (`motion`). Press-scale on buttons, icon buttons, tags, cards,
 *    card titles and segments; the invalid-field nudge; the floating-label
 *    spring; checkbox and radio squish; the check-mark draw; and the segmented
 *    indicator springs. Off, the default still has a static selected surface
 *    (the segmented indicator jumps, and a check mark simply appears). Off
 *    under reduced motion as well. The switch is not part of this effect.
 *
 * ## Browser support
 *
 * - `corner-shape` is new and not in every browser yet. Where it is missing, corners stay round.
 * - The ring uses `mask-composite` and `light-dark()`, which current browsers support.
 * - The tilt and the ring need a mouse or pen. Touch gets neither.
 */
const meta: Meta = {
  title: 'Foundations/Polish',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj;

const panel = (title: string, scope: string, inner: TemplateResult) =>
  html`<section
    data-prism-polish=${scope}
    aria-labelledby=${`polish-${scope}-${title.replace(/\W+/g, '-').toLowerCase()}`}
    style="padding:20px;border-radius:12px;background:var(--prism-color-surface);display:grid;gap:16px;align-content:start;font-family:var(--prism-font-family-sans);color:var(--prism-color-text)"
  >
    <h2
      id=${`polish-${scope}-${title.replace(/\W+/g, '-').toLowerCase()}`}
      style="margin:0;font:600 16px/24px var(--prism-font-family-sans)"
    >
      ${title}
    </h2>
    ${inner}
  </section>`;

/** One set of everything polish touches, plus the pill controls it leaves alone. */
const sample = () => html`
  <prism-card type="clickable" raised>
    <prism-running-indicator
      slot="header"
      data-prism-card-icon
      size="sm"
      tone="success"
      label="lumen-board-01 is online"
    ></prism-running-indicator>
    <prism-card-title slot="header" level="3" href="#lumen-board-01"
      >lumen-board-01</prism-card-title
    >
    <prism-tag slot="header" job="health" tone="success" emphasis="ghost"
      >Online</prism-tag
    >
    <prism-card-description slot="header"
      >Lumen Board 9, Aurora Bay</prism-card-description
    >
    <prism-progress
      label="Storage used"
      value="72"
      show-value
      tone="warning"
    ></prism-progress>
    <prism-card-meta slot="footer">Updated 4 min ago</prism-card-meta>
  </prism-card>
  <prism-card raised>
    <prism-card-title slot="header" level="3">Spectrum notes</prism-card-title>
    <prism-card-description slot="header"
      >A card that is not a link: it tilts and rounds, but gets no light
      ring.</prism-card-description
    >
    <p style="margin:0">Hover it to see the lean.</p>
    <prism-card-meta slot="footer">Static card</prism-card-meta>
    <prism-card-actions slot="footer">
      <prism-button variant="ghost">Dismiss</prism-button>
    </prism-card-actions>
  </prism-card>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <prism-button>Primary</prism-button>
    <prism-button variant="secondary">Secondary</prism-button>
    <prism-button variant="outline">Outline</prism-button>
    <prism-button variant="ghost">Ghost</prism-button>
    <prism-button disabled>Disabled</prism-button>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <prism-tag tone="info">Info</prism-tag>
    <prism-tag tone="success" emphasis="high">Ready</prism-tag>
    <prism-tag tone="warning" emphasis="ghost">Dimming</prism-tag>
  </div>
  <prism-text-input label="Panel name" value="Aurora 9"></prism-text-input>
  <prism-switch label="Auto-refresh" checked></prism-switch>
`;

/** Off and on, side by side. Hover a card or a button on the right. */
export const OffAndOn: Story = {
  render: () =>
    html`<div
      style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px"
    >
      ${panel('Polish off', 'off', sample())}
      ${panel('Polish on', 'all', sample())}
    </div>`,
};

/** Squircle corners only. Compare the card, buttons, tag and input corners. */
export const SquircleCorners: Story = {
  render: () =>
    html`<div
      style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px"
    >
      ${panel('Round corners', 'off', sample())}
      ${panel('Squircle corners', 'squircle', sample())}
    </div>`,
};

/**
 * The light-following border only. Move the pointer across a button or the
 * first card: the ring's highlight follows it. Tab to a button: the ring shows
 * with the usual focus ring, which does not change.
 */
export const LightFollowingBorder: Story = {
  render: () =>
    html`<div style="max-inline-size:480px">
      ${panel('Light border', 'light', sample())}
    </div>`,
};

/** Card tilt only. At most 2.5 degrees; the buttons stay flat. */
export const CardTilt: Story = {
  render: () =>
    html`<div style="max-inline-size:480px">
      ${panel('Card tilt', 'tilt', sample())}
    </div>`,
};

/** A recipe with polish on: the running job card from Card recipes. */
export const RunningJobWithPolish: Story = {
  render: () =>
    html`<div style="max-inline-size:480px">
      ${panel(
        'Running job, polish on',
        'all',
        html`<prism-card standalone raised>
          <prism-running-indicator
            slot="header"
            data-prism-card-icon
            size="sm"
            label="Export running"
          ></prism-running-indicator>
          <prism-card-title slot="header" level="3"
            >Lumen Bloom export</prism-card-title
          >
          <prism-tag slot="header" job="status" tone="accent"
            >In progress</prism-tag
          >
          <prism-card-description slot="header"
            >Preview render for 12 panels</prism-card-description
          >
          <prism-progress
            label="Panels rendered"
            value="7"
            max="12"
            value-text="7 of 12 panels"
            show-value
          ></prism-progress>
          <prism-switch
            label="Notify me when it finishes"
            size="sm"
            checked
            style="margin-block-start:16px"
          ></prism-switch>
          <prism-card-meta slot="footer">Started 2 min ago</prism-card-meta>
          <prism-card-actions slot="footer">
            <prism-button variant="secondary">Stop</prism-button>
          </prism-card-actions>
        </prism-card>`,
      )}
    </div>`,
};
