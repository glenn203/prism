import { css, html, nothing, type CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { TextControl } from '../internal/text-control.js';
import { textRole } from '../internal/control-styles.js';
import { visuallyHidden } from '../internal/visually-hidden.js';

/**
 * A multi-line text input. `autosize` grows it with its content (from
 * `rows`). With `maxlength` and `counter`, shows "n / max"; the visible
 * counter is aria-hidden and a polite live region announces only when the
 * remaining count gets low (≤ 10% or ≤ 20) and at the limit, debounced, so
 * typing isn't drowned in announcements.
 *
 * @tag prism-text-area
 * @slot description - Helper text.
 * @slot error - Error text, shown in the MessageBox when invalid.
 * @csspart label - The label.
 * @csspart control - Wrapper around the textarea.
 * @csspart input - The native textarea.
 * @csspart counter - The visible character counter.
 * @csspart description - Wrapper around the description slot.
 * @csspart message-box - MessageBox.
 * @cssstate invalid - Fails validation.
 * @cssstate disabled - Disabled.
 * @cssstate at-limit - The value has reached maxlength.
 * @fires input - Native input event (composed).
 * @fires change - Committed value change.
 */
export class PrismTextArea extends TextControl {
  static override styles: CSSResultGroup = [
    TextControl.styles,
    visuallyHidden,
    css`
      [part='input'] {
        block-size: auto;
        min-block-size: var(--_prism-control-height);
        padding-block: calc(
          (var(--_prism-control-height) - 1.25rem) /
            2 - var(--prism-border-width, 1px)
        );
        resize: vertical;
      }
      /* While invalid the description is replaced by the error box: drop
         the counter below it instead of overlapping it. */
      :host(:state(invalid)) [part='counter'] {
        float: none;
        margin-block-start: var(--prism-space-1, 0.25rem);
      }
      :host([autosize]) [part='input'] {
        resize: none;
        overflow-y: hidden;
      }
      /* Shares the supporting row with the description, aligned to the end. */
      [part='counter'] {
        float: inline-end;
        margin-block-start: calc(
          -1 * var(--prism-text-supporting-line-height, 1rem)
        );
        padding-inline-start: var(--prism-space-2, 0.5rem);
        ${textRole('supporting')}
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  /** Visible rows (the minimum when autosizing). */
  @property({ type: Number }) rows = 3;
  /** Grow with the content instead of scrolling. */
  @property({ type: Boolean, reflect: true }) autosize = false;
  /** Show a character counter (needs maxlength). */
  @property({ type: Boolean }) counter = false;

  @state() private announcement = '';
  #announceTimer?: ReturnType<typeof setTimeout>;
  #lastBand = '';
  protected override implicitSubmit = false;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#announceTimer);
  }

  #resize(): void {
    const el = this.control as HTMLTextAreaElement | null;
    if (!el || !this.autosize) return;
    el.style.blockSize = 'auto';
    const cs = getComputedStyle(el);
    const borders =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.blockSize = `${el.scrollHeight + borders}px`;
  }

  #announce(): void {
    const max = this.maxlength;
    if (!this.counter || !max) return;
    const left = max - this.value.length;
    const low = Math.max(Math.ceil(max * 0.1), Math.min(20, max));
    const band = left <= 0 ? 'limit' : left <= low ? `low:${left}` : '';
    if (band === this.#lastBand) return;
    this.#lastBand = band;
    clearTimeout(this.#announceTimer);
    if (!band) return;
    this.#announceTimer = setTimeout(() => {
      this.announcement =
        left <= 0
          ? `Character limit reached, ${max} of ${max}.`
          : `${left} characters remaining.`;
    }, 500);
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('autosize') || changed.has('rows'))
      this.#resize();
    if (changed.has('value')) this.#announce();
    this.setState(
      'at-limit',
      !!this.maxlength && this.value.length >= this.maxlength,
    );
  }

  protected renderControl() {
    const a = this.a11yAttrs;
    return html`<textarea
      part="input"
      id="${this.fieldId}-input"
      rows=${this.rows}
      .value=${live(this.value)}
      placeholder=${this.placeholder || ''}
      autocomplete=${a.autocomplete}
      minlength=${a.minlength}
      maxlength=${a.maxlength}
      ?required=${this.required}
      ?readonly=${this.readonly}
      ?disabled=${this.isDisabled}
      @input=${this.onInput}
      @change=${this.onChange}
      @blur=${this.onBlur}
    ></textarea>`;
  }

  protected override renderAfter() {
    if (!this.counter || !this.maxlength) return nothing;
    return html`<div part="counter" aria-hidden="true">
        ${this.value.length} / ${this.maxlength}
      </div>
      <div class="visually-hidden" role="status" aria-live="polite">
        ${this.announcement}
      </div>`;
  }
}
