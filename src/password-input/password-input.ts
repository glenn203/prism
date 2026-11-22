import { css, html, type CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { TextControl } from '../internal/text-control.js';
import { iconEye, iconEyeOff } from '../internal/icons.js';

/**
 * A password input with a show/hide toggle.
 *
 * The toggle is a real button with a constant accessible name and
 * `aria-pressed`, so screen readers hear "Show password, toggle button,
 * pressed/not pressed". Toggling keeps focus, caret and selection in the
 * input. The value is never reflected to an attribute; spellcheck and
 * autocapitalize are off so a revealed value isn't sent to spelling
 * services; the field re-hides on form reset and submit.
 *
 * @tag prism-password-input
 * @slot description - Helper text (e.g. password rules).
 * @slot error - Error text, shown in the attached status box when invalid.
 * @csspart label - The label.
 * @csspart control - Wrapper around input and toggle.
 * @csspart input - The native input.
 * @csspart toggle - The show/hide button.
 * @csspart icon - The toggle icon.
 * @csspart description - Wrapper around the description slot.
 * @csspart error - Attached error status box.
 * @cssstate invalid - Fails validation (after interaction or submit).
 * @cssstate disabled - Disabled.
 * @cssstate revealed - The password is visible.
 * @fires input - Native input event (composed).
 * @fires change - Committed value change.
 */
export class PrismPasswordInput extends TextControl {
  static override styles: CSSResultGroup = [
    TextControl.styles,
    css`
      [part='input']::-ms-reveal {
        display: none;
      }
    `,
  ];

  /** `current-password` for sign-in, `new-password` for sign-up/change. */
  @property() override autocomplete = 'current-password';
  /** Accessible name of the toggle. Constant; state is via aria-pressed. */
  @property({ attribute: 'toggle-label' }) toggleLabel = 'Show password';

  protected override supportsFloating = true;
  @state() private revealed = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('data-prism-adorned', '');
    this.form?.addEventListener('submit', this.#hide);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.form?.removeEventListener('submit', this.#hide);
  }
  #hide = () => {
    this.revealed = false;
  };

  override formResetCallback(): void {
    super.formResetCallback();
    this.revealed = false;
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    this.setState('revealed', this.revealed);
  }

  async #toggle(): Promise<void> {
    const el = this.control as HTMLInputElement;
    const hadFocus = this.shadowRoot!.activeElement === el;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const dir = el.selectionDirection ?? undefined;
    this.revealed = !this.revealed;
    await this.updateComplete;
    if (hadFocus) el.focus();
    if (start !== null && end !== null) el.setSelectionRange(start, end, dir);
  }

  protected renderControl() {
    const a = this.a11yAttrs;
    const id = this.fieldId;
    return html`<input
        part="input"
        id="${id}-input"
        type=${this.revealed ? 'text' : 'password'}
        .value=${live(this.value)}
        placeholder=${this.placeholder || ''}
        autocomplete=${a.autocomplete}
        minlength=${a.minlength}
        maxlength=${a.maxlength}
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        ?required=${this.required}
        ?readonly=${this.readonly}
        ?disabled=${this.isDisabled}
        @input=${this.onInput}
        @change=${this.onChange}
        @keydown=${this.onKeydown}
        @blur=${this.onBlur}
      /><button
        part="toggle"
        class="adornment"
        type="button"
        aria-label=${this.toggleLabel}
        aria-pressed=${String(this.revealed)}
        aria-controls="${id}-input"
        ?disabled=${this.isDisabled}
        @pointerdown=${(e: Event) => {
          // Keep focus (and caret) in the input when clicked.
          if (this.shadowRoot!.activeElement === this.control)
            e.preventDefault();
        }}
        @click=${() => void this.#toggle()}
      >
        ${this.revealed ? iconEyeOff() : iconEye()}
      </button>`;
  }
}
