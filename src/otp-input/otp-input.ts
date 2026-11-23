import { css, html, type CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { TextControl } from '../internal/text-control.js';

/**
 * A one-time code input.
 *
 * One real `<input>` (autocomplete="one-time-code", inputmode="numeric")
 * drawn as `length` visual boxes. A single input keeps one accessible name,
 * one tab stop and one value for screen readers, and is what mobile
 * SMS-code autofill and password managers target; N separate inputs break
 * autofill, paste and screen-reader reading. The boxes are aria-hidden
 * decoration; the input sits invisibly on top of them.
 *
 * @tag prism-otp-input
 * @slot description - Helper text (e.g. "Sent to •••• 1234").
 * @slot error - Error text, shown in the MessageBox when invalid.
 * @csspart label - The label.
 * @csspart control - Wrapper around the boxes and the invisible input.
 * @csspart cells - Row of visual boxes.
 * @csspart cell - One visual box (also `cell-active`, `cell-filled`).
 * @csspart description - Wrapper around the description slot.
 * @csspart error - MessageBox.
 * @cssstate invalid - Fails validation.
 * @cssstate disabled - Disabled.
 * @cssstate focused - The input has focus (drives the active box ring).
 * @fires input - Value changed.
 * @fires change - Committed value change.
 * @fires prism-otp-complete - All boxes are filled. `detail.value`.
 */
export class PrismOtpInput extends TextControl {
  static override styles: CSSResultGroup = [
    TextControl.styles,
    css`
      /* Shrink-wrap so the MessageBox matches the row of boxes. */
      :host {
        display: inline-block;
      }
      /* Block (not inline-block) so no line-box descender gap sits under
         the boxes: description/error offsets are measured from the boxes. */
      [part='control'] {
        display: block;
        inline-size: fit-content;
      }
      [part~='cells'] {
        display: flex;
        gap: var(--prism-space-2, 0.5rem);
      }
      [part~='cell'] {
        box-sizing: border-box;
        display: grid;
        place-items: center;
        inline-size: var(--_prism-control-height);
        block-size: var(--_prism-control-height);
        border: var(--prism-border-width, 1px) solid transparent;
        border-radius: var(--prism-radius-5, 5px);
        font-variant-numeric: tabular-nums;
      }
      /* The real input: invisible, covers the boxes, receives all input. */
      input {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        opacity: 0;
        font-size: 16px; /* avoid iOS zoom on focus */
        color: transparent;
        caret-color: transparent;
        background: transparent;
        cursor: text;
      }
      input:disabled {
        cursor: not-allowed;
      }
    `,
  ];

  /** Number of characters. */
  @property({ type: Number }) length = 6;
  override autocomplete = 'one-time-code';
  protected override requiredMessage = 'Please enter the full code.';

  @state() private caret = 0;
  @state() private focused = false;

  #sanitize(raw: string): string {
    return raw.replace(/\D/g, '').slice(0, this.length);
  }

  protected override formValue(): string {
    return this.value;
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('value') || changed.has('length'))
      this.value = this.#sanitize(this.value);
    super.willUpdate(changed);
    this.setState('focused', this.focused);
  }

  #syncCaret = () => {
    const el = this.control as HTMLInputElement | null;
    if (!el) return;
    // Always type at the end: boxes behave like a single growing field.
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end)
      el.setSelectionRange(end, end);
    this.caret = Math.min(end, this.length - 1);
  };

  #commit(next: string): void {
    const el = this.control as HTMLInputElement;
    const was = this.value;
    this.value = next;
    el.value = next;
    this.#syncCaret();
    if (next !== was && next.length === this.length) {
      void this.updateComplete.then(() =>
        this.dispatchEvent(
          new CustomEvent('prism-otp-complete', {
            bubbles: true,
            composed: true,
            detail: { value: next },
          }),
        ),
      );
    }
  }

  protected override onInput = (event: Event): void => {
    this.#commit(this.#sanitize((event.target as HTMLInputElement).value));
  };

  #onPaste = (event: ClipboardEvent): void => {
    const text = event.clipboardData?.getData('text') ?? '';
    event.preventDefault();
    if (this.readonly) return;
    this.#commit(this.#sanitize(text));
    this.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertFromPaste',
      }),
    );
  };

  protected renderControl() {
    const id = this.fieldId;
    const chars = [...this.value];
    const cells = Array.from({ length: this.length }, (_, i) => {
      const parts = ['cell'];
      if (chars[i]) parts.push('cell-filled');
      if (this.focused && i === this.caret) parts.push('cell-active');
      return html`<span part=${parts.join(' ')}>${chars[i] ?? ''}</span>`;
    });
    return html`<span part="cells" aria-hidden="true">${cells}</span
      ><input
        id="${id}-input"
        type="text"
        .value=${live(this.value)}
        autocomplete="one-time-code"
        inputmode="numeric"
        pattern="\\d{${this.length}}"
        minlength=${this.length}
        maxlength=${this.length}
        spellcheck="false"
        ?required=${this.required}
        ?readonly=${this.readonly}
        ?disabled=${this.isDisabled}
        @input=${this.onInput}
        @change=${this.onChange}
        @keydown=${this.onKeydown}
        @paste=${this.#onPaste}
        @focus=${() => {
          this.focused = true;
          this.#syncCaret();
        }}
        @blur=${() => {
          this.focused = false;
          this.validityCtl.touch();
        }}
        @click=${this.#syncCaret}
        @select=${this.#syncCaret}
        @keyup=${this.#syncCaret}
      />`;
  }

  // A partly filled code is incomplete, even though minlength only checks
  // user edits natively.
  protected override validate(): [ValidityStateFlags, string] | null {
    const n = this.value.length;
    return !this.isDisabled && n > 0 && n < this.length
      ? [{ tooShort: true }, `Enter all ${this.length} digits.`]
      : null;
  }
}
