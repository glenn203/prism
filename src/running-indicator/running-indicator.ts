import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { tonePalette } from '../internal/tones.js';
import { visuallyHidden } from '../internal/visually-hidden.js';
import type { TagTone } from '../tag/tag.js';

/**
 * Shows that something is running right now: a solid dot that breathes, with
 * one ring that spreads out of it and fades, like light leaving a prism. Use it
 * beside a task or card title while a job is in progress, and remove it (or
 * swap it for a Tag that says "Done") when the job ends.
 *
 * - `role="status"` with a written label ("Running" by default). The label is
 *   always in the page for screen readers; `show-label` also shows it.
 *   Change `label` to say what is running: "Export running".
 * - Sizes: `sm` 16px, `md` 24px (default), `lg` 40px. The drawing is a 24 unit
 *   box that scales with the size.
 * - `tone` colours both the dot and the ring: accent (default), neutral, info,
 *   success, warning or danger. Use success for "online".
 * - Motion: the ring grows from the dot's edge (radius 4 to 9) and fades from
 *   60% to nothing while the dot swells from 4 to 4.6 and back, both in step.
 *   One pulse takes 1.92s, then it rests for 800ms before the next (a 2.72s
 *   cycle). In the rest the ring is gone and the dot is still. Under
 *   `prefers-reduced-motion: reduce` it holds still as the dot with a faint
 *   ring. The dot is always there, so motion is never the only signal.
 * - It does not show progress. For a known amount of work use Progress.
 *
 * @tag prism-running-indicator
 * @csspart base - The status wrapper.
 * @csspart graphic - The SVG with the dot and ring.
 * @csspart label - The label text (visually hidden unless `show-label`).
 * @cssprop [--prism-running-cycle=2720ms] - One whole cycle: a 1.92s pulse (the first 70.6%) and an 800ms rest.
 */
export class PrismRunningIndicator extends LitElement {
  static override styles = [
    tonePalette('tone'),
    visuallyHidden,
    css`
      :host {
        --_size: 1.5rem;
        display: inline-block;
        vertical-align: middle;
        min-inline-size: 0;
      }
      :host([size='sm']) {
        --_size: 1rem;
      }
      :host([size='lg']) {
        --_size: 2.5rem;
      }
      :host([hidden]) {
        display: none;
      }
      /* Dot and ring both use the tone's solid colour. */
      :host {
        --_dot: var(--_tone-high-bg);
      }
      [part='base'] {
        display: inline-flex;
        align-items: center;
        gap: var(--prism-space-2, 0.5rem);
        font-family: var(--prism-font-family-sans, Inter, sans-serif);
        font-size: var(--prism-text-body-font-size, 0.875rem);
        line-height: var(--prism-font-line-height-20, 1.25rem);
      }
      [part='graphic'] {
        flex: none;
        inline-size: var(--_size);
        block-size: var(--_size);
        overflow: visible;
      }
      .core {
        fill: var(--_dot);
        animation: prism-running-core var(--prism-running-cycle, 2720ms) linear
          infinite;
      }
      .ring {
        fill: none;
        stroke: var(--_dot);
        stroke-width: 2;
        opacity: 0;
        animation: prism-running-ring var(--prism-running-cycle, 2720ms) linear
          infinite;
      }
      /* One cycle is 2720ms: a 1920ms pulse (70.588%), then an 800ms rest in
         which the ring is gone and the dot is still. */
      @keyframes prism-running-ring {
        0% {
          r: 4px;
          opacity: 0.6;
        }
        70.588%,
        100% {
          r: 9px;
          opacity: 0;
        }
      }
      @keyframes prism-running-core {
        0%,
        70.588%,
        100% {
          r: 4px;
          opacity: 1;
        }
        35.294% {
          r: 4.6px;
          opacity: 0.85;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .ring,
        .core {
          animation: none;
        }
        /* Still: the dot and a faint ring. */
        .ring {
          r: 7px;
          opacity: 0.3;
        }
      }
      @media (forced-colors: active) {
        .core {
          fill: Highlight;
        }
        .ring {
          stroke: Highlight;
        }
      }
    `,
  ];

  /** What is running, for screen readers. Default "Running". */
  @property() label = 'Running';
  /** Also shows the label as text beside the dot. */
  @property({ type: Boolean, attribute: 'show-label' }) showLabel = false;
  /** Size: sm (16px), md (24px) or lg (40px). */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';
  /** Colour: accent (default), neutral, info, success, warning or danger. */
  @property({ reflect: true }) tone: TagTone = 'accent';

  override render() {
    return html`<span part="base" role="status">
      <svg
        part="graphic"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle class="ring" cx="12" cy="12" r="4" />
        <circle class="core" cx="12" cy="12" r="4" />
      </svg>
      <span part="label" class=${this.showLabel ? '' : 'visually-hidden'}
        >${this.label}</span
      >
    </span>`;
  }
}
