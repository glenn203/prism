import { LitElement, css, html, nothing, unsafeCSS } from 'lit';
import { property, query } from 'lit/decorators.js';
import { canAnimate } from '../internal/choice-motion.js';
import { FormAssociated } from '../internal/form-associated.js';
import { uniqueId } from '../internal/ids.js';
import {
  controlBox,
  controlSize,
  textRole,
} from '../internal/control-styles.js';
import {
  fieldPartsStyles,
  renderDescription,
  renderError,
  renderLabel,
  syncFieldA11y,
} from '../internal/field-parts.js';
import { FieldValidityController } from '../internal/field-validity.js';
import { NUDGE_TUNE, nudgeLook } from '../internal/field-motion.js';
import { SpringMotion } from '../internal/spring-motion.js';
import type { PrismOption } from '../option/option.js';

const isOption = (el: Element): el is PrismOption =>
  el.localName === 'prism-option';

/** The chevron, as a mask so the browser's own indicator takes the text colour. */
const CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6l4 4 4-4'/></svg>",
)}")`;

/**
 * A single-value select. It renders a native `<select>` (with `<option>`s made
 * from the child `prism-option` elements), so the keyboard, type-ahead, form
 * reset and the mobile picker are the browser's own.
 *
 * - Where `appearance: base-select` is supported (Chrome and Edge 135 and
 *   later) the trigger, the popup and the options are drawn in the Prism look,
 *   and the popup grows out of the trigger. Elsewhere the browser's own select
 *   shows, with the same label, error and form behaviour.
 * - Named by a real `<label for>`. Help text is in the `description` slot and
 *   the message for a failed check in the `error` slot; the input is described
 *   by the error only while invalid.
 * - Joins the surrounding form: submits `value` under `name`, fails
 *   validation while `required` and empty, and resets with the form. The
 *   native select lives in shadow DOM, so the host mirrors its value and
 *   validity through ElementInternals.
 * - Single choice only. A multiple select is a listbox, not a dropdown, so it
 *   is not part of this component; it will be a separate component if needed.
 * - Fires `input` (the native event, composed) and `change` after the user
 *   picks a different option.
 *
 * @tag prism-select
 * @slot - `prism-option` elements.
 * @slot description - Helper text. Replaced by the error while invalid.
 * @slot error - Error text, shown in the attached status box when invalid.
 * @csspart label - The label.
 * @csspart field - Wrapper around trigger and attached error.
 * @csspart anchor - Wrapper around the trigger only (it nudges when invalid).
 * @csspart trigger - The native select (focus target). Its popup is `::picker(select)`, its indicator `::picker-icon`.
 * @csspart option - Each native option. Style its `:checked`, `:hover` and `::checkmark`.
 * @csspart description - Helper text wrapper.
 * @csspart error - Attached error status box.
 * @cssstate invalid - Fails validation (after interaction or submit).
 * @cssstate disabled - Disabled.
 * @cssstate placeholder - No value selected.
 * @fires input - User picked a different option.
 * @fires change - User picked a different option.
 */
export class PrismSelect extends FormAssociated(LitElement) {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles = [
    controlSize,
    fieldPartsStyles,
    css`
      [part='field'] {
        position: relative;
      }
      /* Containing block for the trigger; the error box is a later sibling. */
      [part='anchor'] {
        position: relative;
      }
      [part='trigger'] {
        position: relative;
        z-index: 1;
        inline-size: 100%;
        ${controlBox}
        ${textRole('body')}
      }
      @supports (appearance: base-select) {
        [part='trigger'],
        [part='trigger']::picker(select) {
          appearance: base-select;
        }
        [part='trigger'] {
          display: flex;
          align-items: center;
          gap: var(--prism-space-2, 0.5rem);
          cursor: default;
          user-select: none;
        }
        [part='trigger']::picker-icon {
          content: '';
          flex: none;
          inline-size: 1rem;
          block-size: 1rem;
          margin-inline-start: auto;
          background: currentcolor;
          mask: ${unsafeCSS(CHEVRON)} center / contain no-repeat;
          transition: rotate var(--prism-duration-default, 200ms)
            var(--prism-ease-spring, ease);
        }
        [part='trigger']:open::picker-icon {
          rotate: 180deg;
        }
        /* The popup grows out of the trigger's lower edge. */
        [part='trigger']::picker(select) {
          box-sizing: border-box;
          margin-block-start: var(--prism-space-1, 0.25rem);
          max-block-size: 18rem;
          transform-origin: 50% 0;
          opacity: 1;
          transition:
            opacity var(--prism-duration-fast, 120ms)
              var(--prism-ease-standard, ease),
            transform var(--prism-duration-default, 200ms)
              var(--prism-ease-spring, ease),
            overlay var(--prism-duration-default, 200ms) allow-discrete,
            display var(--prism-duration-default, 200ms) allow-discrete;
          ${textRole('body')}
        }
        [part='trigger']:not(:open)::picker(select) {
          opacity: 0;
          transform: translateY(-6px) scale(0.96, 0.88);
        }
        @starting-style {
          [part='trigger']:open::picker(select) {
            opacity: 0;
            transform: translateY(-6px) scale(0.96, 0.88);
          }
        }
        [part='option'] {
          display: flex;
          align-items: center;
          gap: var(--prism-space-2, 0.5rem);
          min-block-size: 1.5rem;
          cursor: default;
        }
        /* The placeholder: the rule above would otherwise show it in the popup. */
        [part='option'][hidden] {
          display: none;
        }
      }
    `,
  ];

  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';
  @property() label = '';
  @property() value = '';
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) required = false;

  @query('[part="trigger"]') private readonly trigger!: HTMLSelectElement;

  readonly #nudge: SpringMotion<'n', 'anchor'> = new SpringMotion(
    ['n'],
    { anchor: { el: () => this.renderRoot?.querySelector('[part="anchor"]') } },
    (pose) => ({ anchor: { transform: nudgeLook(pose) } }),
  );

  readonly #validity = new FieldValidityController(this);
  readonly #id = uniqueId('prism-select');
  readonly #redraw = (): void => this.requestUpdate();
  readonly #changes = new MutationObserver(this.#redraw);
  #defaultValue: string | null = null;
  #wasInvalid = false;

  get options(): PrismOption[] {
    return [...this.children].filter(isOption);
  }
  get selectedOption(): PrismOption | null {
    return this.options.find((o) => o.resolvedValue === this.value) ?? null;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    this.#validity.touch();
    return this.internals.reportValidity();
  }
  override focus(options?: FocusOptions): void {
    this.trigger?.focus(options);
  }
  /**
   * Opens the popup, as native `showPicker()` does: it needs a user gesture (a
   * click or key press) and throws `NotAllowedError` without one. Does nothing
   * where the browser has no `showPicker()` on a select (WebKit).
   */
  showPicker(): void {
    if (this.trigger && 'showPicker' in this.trigger) this.trigger.showPicker();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#defaultValue = this.getAttribute('value');
    this.addEventListener('prism-option-change', this.#redraw);
    // An option's text is its content, so watch it as well as its properties.
    this.#changes.observe(this, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('prism-option-change', this.#redraw);
    this.#changes.disconnect();
  }

  #initialValue(): string {
    if (this.#defaultValue !== null) return this.#defaultValue;
    return this.options.find((o) => o.selected)?.resolvedValue ?? '';
  }

  override firstUpdated(): void {
    if (this.#defaultValue === null) this.value = this.#initialValue();
    this.#nudge.snap({ n: 0 });
  }

  formResetCallback(): void {
    this.value = this.#initialValue();
    this.#validity.reset();
  }
  formStateRestoreCallback(s: string | File | FormData | null): void {
    if (
      typeof s === 'string' &&
      this.options.some((o) => o.resolvedValue === s)
    )
      this.value = s;
  }
  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    this.internals.setFormValue(
      this.isDisabled ? null : this.value,
      this.value,
    );
  }

  override updated(): void {
    const missing = this.required && !this.isDisabled && this.value === '';
    if (missing)
      this.internals.setValidity(
        { valueMissing: true },
        'Please select an item in the list.',
        this.trigger,
      );
    else this.internals.setValidity({});
    const invalid = this.#validity.sync();
    // Error replaces helper text: describe by the error only while invalid.
    syncFieldA11y(this.renderRoot, this.trigger, this.#id, invalid, {
      hideDescriptionWhenInvalid: true,
    });
    this.renderRoot
      .querySelector('[part="description"]')
      ?.toggleAttribute('hidden', invalid);
    this.setState('placeholder', this.value === '');
    if (invalid && !this.#wasInvalid && this.#canMove())
      this.#nudge.go({ n: 0 }, () => NUDGE_TUNE);
    this.#wasInvalid = invalid;
  }

  #canMove(): boolean {
    return canAnimate(this, this.renderRoot?.querySelector('[part="anchor"]'));
  }

  /** The native `input` event reaches the host as it is; take the value first. */
  #onInput(): void {
    this.value = this.trigger.value;
    this.#validity.touch();
  }

  /** A native `change` stays inside the shadow root, so say it again on the host. */
  #onChange(): void {
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  override render() {
    const id = this.#id;
    const picked = this.selectedOption;
    return html`
      ${renderLabel(id, this.label, 'control')}
      <div part="field">
        <div part="anchor">
          <select
            part="trigger"
            id="control"
            ?required=${this.required}
            ?disabled=${this.isDisabled}
            @input=${() => this.#onInput()}
            @change=${() => this.#onChange()}
            @blur=${() => this.#validity.touch()}
          >
            ${
              picked
                ? nothing
                : html`<option
                    part="option"
                    value=""
                    hidden
                    disabled
                    .selected=${true}
                  >
                    ${this.placeholder}
                  </option>`
            }
            ${this.options.map(
              (o) =>
                html`<option
                  part="option"
                  value=${o.resolvedValue}
                  ?disabled=${o.disabled}
                  .selected=${o === picked}
                >
                  ${o.text}
                </option>`,
            )}
          </select>
        </div>
        ${renderError(id)}
      </div>
      ${renderDescription(id)}
      <slot hidden @slotchange=${this.#redraw}></slot>
    `;
  }
}
