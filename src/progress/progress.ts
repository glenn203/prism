import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { tonePalette } from '../internal/tones.js';
import { uniqueId } from '../internal/ids.js';
import type { TagTone } from '../tag/tag.js';

/**
 * A bar that shows how far something has got. Common props: `value`, `max`,
 * `label`, `tone`. NAMES PROVISIONAL.
 *
 * - A native `<progress>` named by a real `<label for>`. Leave `value` off
 *   for an indeterminate bar (the native element is indeterminate and the
 *   stripe moves; it stops under reduced motion).
 * - The label is visible by default. `hide-label` hides it from sight only.
 *   `show-value` writes the number beside it ("60%", or `value-text` such as
 *   "3 of 5 steps", which is also the `aria-valuetext`). Colour is never the
 *   only signal: the fill length and the written value both say it.
 * - The track and fill are decorative: they keep the comet look; the native
 *   `<progress>` is the accessible bar.
 * - Look: no track border; a faint inset edge shadow on the track. The fill is
 *   a comet: a bright head and a fading tail at the leading edge over a base
 *   gradient that is lighter at the left, plus a soft glow ahead of it
 *   (`--prism-progress-*` tokens). The last 14px hold 3:1 on the track. A fill
 *   under 24px hides its tail (`:state(tiny)`), a full bar drops the glow
 *   (`:state(full)`).
 * - Use it for a task with a known end. For "loading, no idea how long" use
 *   a skeleton or an indeterminate bar.
 *
 * @tag prism-progress
 * @csspart base - The row (label, value).
 * @csspart label - The visible label.
 * @csspart value - The written value.
 * @csspart track - The bar's track.
 * @csspart fill - The filled part.
 * @cssstate indeterminate - No value.
 * @cssstate tiny - The fill is too short for a tail.
 * @cssstate full - The value has reached max.
 */
export class PrismProgress extends LitElement {
  static override styles = [
    tonePalette('tone'),
    css`
      :host {
        /* PROPOSED progress text: 12/20, weight 400 (the supporting style). */
        --_progress-font-size: var(--prism-text-supporting-font-size, 0.75rem);
        --_progress-line-height: var(--prism-font-line-height-20, 1.25rem);
        display: block;
        min-inline-size: 0;
      }
      :host([hidden]) {
        display: none;
      }
      [part='base'] {
        display: grid;
        gap: var(--prism-space-1, 0.25rem);
      }
      [part='row'] {
        display: flex;
        justify-content: space-between;
        gap: var(--prism-space-2, 0.5rem);
        font-family: var(--prism-font-family-sans, Inter, sans-serif);
        font-size: var(--_progress-font-size);
        line-height: var(--_progress-line-height);
      }
      [part='label'],
      [part='value'] {
        min-inline-size: 0;
      }
      [part='value'] {
        font-variant-numeric: tabular-nums;
        margin-inline-start: auto;
      }
      .vh {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      [part='track'] {
        box-sizing: border-box;
        position: relative;
        block-size: 0.5rem;
        overflow: hidden;
        border-radius: var(--prism-radius-full, 9999px);
      }
      /* The native bar is for assistive tech; the fill is the visual. */
      [part='track'] progress {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
        opacity: 0;
        pointer-events: none;
      }
      [part='fill'] {
        block-size: 100%;
        inline-size: var(--_fill, 0%);
        border-radius: inherit;
      }
      /* The fill is a comet; it travels the track in 1.6s. */
      :host(:state(indeterminate)) [part='fill'] {
        inline-size: 40%;
        animation: prism-progress-slide 1600ms
          var(--prism-ease-settle, cubic-bezier(0.4, 0, 0.2, 1)) infinite;
      }
      @keyframes prism-progress-slide {
        from {
          margin-inline-start: -40%;
        }
        to {
          margin-inline-start: 100%;
        }
      }
      @keyframes prism-progress-pulse {
        0%,
        100% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
      }
      /* Reduced motion: no travel. A value change is instant, and an unknown
         value pulses its opacity (0.6 to 1) over 2s. */
      @media (prefers-reduced-motion: reduce) {
        [part='fill'] {
          transition: none;
        }
        :host(:state(indeterminate)) [part='fill'] {
          animation: prism-progress-pulse 2s ease-in-out infinite;
          margin-inline-start: 30%;
        }
      }
    `,
  ];

  /** Required. What is progressing: "Setup", "Storage used". */
  @property() label = '';
  /** Current value from 0 to `max`. Leave off when unknown. */
  @property({ type: Number }) value?: number;
  @property({ type: Number }) max = 100;
  /** Writes the value beside the label. */
  @property({ type: Boolean, attribute: 'show-value' }) showValue = false;
  /** Replaces the percent with words, for example "3 of 5 steps". */
  @property({ attribute: 'value-text' }) valueText = '';
  /** Hides the label from sight (it still names the bar). */
  @property({ type: Boolean, attribute: 'hide-label' }) hideLabel = false;
  @property({ reflect: true }) tone: TagTone = 'accent';

  readonly #internals = this.attachInternals();
  readonly #id = uniqueId('prism-progress');
  #resize?: ResizeObserver;

  get #determinate(): boolean {
    return typeof this.value === 'number' && !Number.isNaN(this.value);
  }

  get #now(): number {
    return Math.min(this.max, Math.max(0, this.value ?? 0));
  }

  get #text(): string {
    if (!this.#determinate) return '';
    return (
      this.valueText || `${Math.round((this.#now / (this.max || 1)) * 100)}%`
    );
  }

  #setState(name: string, on: boolean): void {
    try {
      if (on) this.#internals.states.add(name);
      else this.#internals.states.delete(name);
    } catch {
      /* :state() unsupported */
    }
  }

  /** A fill under the token's width (24px) is too short for a comet tail. */
  #measure = (): void => {
    const track = this.shadowRoot?.querySelector('[part="track"]');
    if (!track) return;
    const min =
      parseFloat(
        getComputedStyle(this).getPropertyValue(
          '--prism-progress-tail-min-fill',
        ),
      ) || 24;
    const pct = this.#determinate ? (this.#now / (this.max || 1)) * 100 : 40; // the indeterminate stripe is 40% wide
    this.#setState(
      'tiny',
      (track.getBoundingClientRect().width * pct) / 100 < min,
    );
  };

  #observe(): void {
    const track = this.shadowRoot?.querySelector('[part="track"]');
    if (!track || this.#resize || typeof ResizeObserver !== 'function') return;
    this.#resize = new ResizeObserver(this.#measure);
    this.#resize.observe(track);
  }

  override firstUpdated(): void {
    this.#observe();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#observe();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = undefined;
  }

  override willUpdate(): void {
    this.#setState('indeterminate', !this.#determinate);
    this.#setState(
      'full',
      this.#determinate && this.#now >= this.max && this.max > 0,
    );
  }

  override updated(): void {
    this.#measure();
    if (!this.label)
      console.error(
        '[prism-progress] `label` is required: a progress bar needs an accessible name.',
        this,
      );
  }

  override render() {
    const pct = this.#determinate
      ? Math.round((this.#now / (this.max || 1)) * 1000) / 10
      : 0;
    return html`<div part="base">
      ${
        this.hideLabel && !this.showValue
          ? html`<label part="label" class="vh" for=${this.#id}
              >${this.label}</label
            >`
          : html`<div part="row">
              <label
                part="label"
                class=${this.hideLabel ? 'vh' : ''}
                for=${this.#id}
                >${this.label}</label
              >
              ${
                this.showValue && this.#determinate
                  ? html`<span part="value" aria-hidden="true"
                      >${this.#text}</span
                    >`
                  : nothing
              }
            </div>`
      }
      <div part="track" style=${`--_fill:${pct}%`}>
        <progress
          id=${this.#id}
          max=${this.max}
          value=${this.#determinate ? this.#now : nothing}
          aria-valuetext=${
            this.#determinate && this.valueText ? this.valueText : nothing
          }
        ></progress>
        <div part="fill" aria-hidden="true"></div>
      </div>
    </div>`;
  }
}
