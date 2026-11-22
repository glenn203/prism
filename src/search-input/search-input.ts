import { css, html, type CSSResultGroup } from 'lit';
import { live } from 'lit/directives/live.js';
import { property } from 'lit/decorators.js';
import { TextControl } from '../internal/text-control.js';
import { iconSearch, iconX } from '../internal/icons.js';

/**
 * A search input (`type=search`, so its role is searchbox) with a clear
 * button. The clear button appears when there is a value; Escape also
 * clears. Clearing returns focus to the input. Enter fires `search`
 * (cancelable) and then submits the owning form, if any.
 *
 * @tag prism-search-input
 * @slot description - Helper text.
 * @slot error - Error text, shown in the attached status box when invalid.
 * @csspart label - The label.
 * @csspart control - Wrapper around icon, input and clear button.
 * @csspart search-icon - Leading decorative search icon.
 * @csspart input - The native input.
 * @csspart clear - The clear button.
 * @csspart icon - Icons.
 * @csspart description - Wrapper around the description slot.
 * @csspart error - Attached error status box.
 * @cssstate invalid - Fails validation.
 * @cssstate disabled - Disabled.
 * @fires input - On typing and on clear.
 * @fires change - Committed value change (including clear).
 * @fires search - Enter pressed. `detail.value`. Cancel to skip form submit.
 */
export class PrismSearchInput extends TextControl {
  static override styles: CSSResultGroup = [
    TextControl.styles,
    css`
      [part='input'] {
        padding-inline-start: calc(
          var(--prism-control-padding-inline, 0.75rem) + 20px
        );
      }
      [part='input']::-webkit-search-cancel-button,
      [part='input']::-webkit-search-decoration {
        appearance: none;
      }
      [part='search-icon'] {
        position: absolute;
        inset-block: 0;
        inset-inline-start: var(--prism-control-padding-inline, 0.75rem);
        display: grid;
        place-items: center;
        pointer-events: none;
        z-index: 2; /* above the input (themes raise it to z 1) */
      }
    `,
  ];

  /** Accessible name of the clear button. */
  @property({ attribute: 'clear-label' }) clearLabel = 'Clear search';

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('data-prism-adorned', '');
  }

  #clear(): void {
    this.value = '';
    const el = this.control!;
    el.value = '';
    this.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'deleteContent',
      }),
    );
    this.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
  }

  protected override onKeydown = (event: KeyboardEvent): void => {
    if (event.isComposing) return;
    if (event.key === 'Escape' && this.value && !this.readonly) {
      event.preventDefault();
      event.stopPropagation(); // don't also close a surrounding dialog
      this.#clear();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const go = this.dispatchEvent(
        new CustomEvent('search', {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { value: this.value },
        }),
      );
      if (go) this.form?.requestSubmit();
    }
  };

  protected renderControl() {
    const a = this.a11yAttrs;
    const id = this.fieldId;
    const showClear = !!this.value && !this.readonly && !this.isDisabled;
    return html`<span part="search-icon">${iconSearch()}</span
      ><input
        part="input"
        id="${id}-input"
        type="search"
        .value=${live(this.value)}
        placeholder=${this.placeholder || ''}
        autocomplete=${a.autocomplete}
        minlength=${a.minlength}
        maxlength=${a.maxlength}
        enterkeyhint="search"
        ?required=${this.required}
        ?readonly=${this.readonly}
        ?disabled=${this.isDisabled}
        @input=${this.onInput}
        @change=${this.onChange}
        @keydown=${this.onKeydown}
        @blur=${this.onBlur}
      /><button
        part="clear"
        class="adornment"
        type="button"
        aria-label=${this.clearLabel}
        aria-controls="${id}-input"
        ?hidden=${!showClear}
        @pointerdown=${(e: Event) => e.preventDefault()}
        @click=${() => this.#clear()}
      >
        ${iconX()}
      </button>`;
  }
}
