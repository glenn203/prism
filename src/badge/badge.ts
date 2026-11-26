import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { tonePalette } from '../internal/tones.js';
import { visuallyHidden } from '../internal/visually-hidden.js';
import type { TagTone } from '../tag/tag.js';

export type BadgeStatus = 'live' | 'running' | 'stopped';

const STATUS_TEXT: Record<BadgeStatus, string> = {
  live: 'Live',
  running: 'Running',
  stopped: 'Stopped',
};

/**
 * A small label that sits on another control, for one of two jobs (the Badge
 * page): a **count** (how many) or a process **status** (Live, Running,
 * Stopped). For words on a row (priority, keywords, workflow) use Tag.
 *
 * - `job="count"` (default): `count` is the number; above `max` (default 99)
 *   it reads "99+". A zero count is hidden unless `show-zero`. The badge is
 *   not a button: you click the parent. Put it inside the control it counts,
 *   so the control reads "Updates 48".
 * - `job="status"`: `status` is `live`, `running` or `stopped` and the badge
 *   says the word. A small prefix dot shows by default (a soft pulse for Live,
 *   which stops under reduced motion); put your own icon in the `icon` slot.
 *   The word is always there, so colour and pulse are never the only signal.
 *
 * `tone` is NAME PROVISIONAL for Badge (Design maps tone; Tag's enum is used).
 * Defaults: count `accent`, live `success`, running `info`, stopped `neutral`.
 *
 * @tag prism-badge
 * @slot icon - Status only. Replaces the default dot. Decorative.
 * @csspart base - The badge box.
 * @csspart dot - The default status dot.
 * @cssstate empty - A zero count that is hidden.
 */
export class PrismBadge extends LitElement {
  static override styles = [
    tonePalette('data-prism-tone'),
    visuallyHidden,
    css`
      :host {
        /* PROPOSED badge text: 12/16, weight 600, tabular figures. */
        --_badge-font-size: var(--prism-text-supporting-font-size, 0.75rem);
        --_badge-line-height: var(--prism-font-line-height-16, 1rem);
        --_badge-font-weight: var(--prism-font-weight-semibold, 600);
        display: inline-flex;
        vertical-align: middle;
      }
      :host([hidden]),
      :host(:state(empty)) {
        display: none;
      }
      [part='base'] {
        position: relative;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: var(--prism-space-1, 0.25rem);
        min-block-size: 1.25rem;
        min-inline-size: 1.25rem;
        padding-inline: var(--prism-space-1, 0.25rem);
        justify-content: center;
        border: var(--prism-border-width, 1px) solid transparent;
        border-radius: var(--prism-radius-full, 9999px);
        font-family: var(--prism-font-family-sans, Inter, sans-serif);
        font-size: var(--_badge-font-size);
        line-height: var(--_badge-line-height);
        font-weight: var(--_badge-font-weight);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      :host([job='status']) [part='base'] {
        padding-inline: var(--prism-space-2, 0.5rem);
      }
      [part='dot'] {
        flex: none;
        inline-size: 0.5rem;
        block-size: 0.5rem;
        border-radius: 50%;
        background: currentColor;
      }
      :host([status='live']) [part='dot'] {
        animation: prism-badge-pulse 1600ms ease-in-out infinite;
      }
      @keyframes prism-badge-pulse {
        50% {
          opacity: 0.35;
          transform: scale(0.8);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host([status='live']) [part='dot'] {
          animation: none;
        }
      }
      ::slotted([slot='icon']) {
        flex: none;
        inline-size: 1rem;
        block-size: 1rem;
      }
    `,
  ];

  @property({ reflect: true }) job: 'count' | 'status' = 'count';
  /** Count: the number. */
  @property({ type: Number }) count = 0;
  /** Count: above this it reads "{max}+". Use one cap across the product. */
  @property({ type: Number }) max = 99;
  /** Count: show a zero. Off by default (a zero badge is hidden). */
  @property({ type: Boolean, attribute: 'show-zero' }) showZero = false;
  /** Status: live, running or stopped. */
  @property({ reflect: true }) status?: BadgeStatus;
  /** Colour family. Defaults follow the job (see the class doc). */
  @property({ reflect: true }) tone?: TagTone;

  readonly #internals = this.attachInternals();

  /** The tone in effect. */
  get effectiveTone(): TagTone {
    if (this.tone) return this.tone;
    if (this.job === 'status')
      return this.status === 'live'
        ? 'success'
        : this.status === 'running'
          ? 'info'
          : 'neutral';
    return 'accent';
  }

  override willUpdate(): void {
    const empty = this.job === 'count' && this.count <= 0 && !this.showZero;
    try {
      if (empty) this.#internals.states.add('empty');
      else this.#internals.states.delete('empty');
    } catch {
      /* :state() unsupported */
    }
    // The theme reads the tone from this attribute; never set by the author.
    this.setAttribute('data-prism-tone', this.effectiveTone);
  }

  override updated(): void {
    if (this.job === 'status' && !this.status)
      console.error(
        '[prism-badge] `status` is required when job="status": live, running or stopped.',
        this,
      );
  }

  override render() {
    if (this.job === 'status') {
      const word = this.status ? STATUS_TEXT[this.status] : '';
      return html`<span part="base"
        ><slot name="icon"><span part="dot" aria-hidden="true"></span></slot
        >${word}</span
      >`;
    }
    const over = this.count > this.max;
    return html`<span part="base"
      >${
        over
          ? html`<span aria-hidden="true">${this.max}+</span
              ><span class="visually-hidden">more than ${this.max}</span>`
          : this.count
      }</span
    >`;
  }
}
