import { css, html, nothing, type CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { canAnimate } from '../internal/choice-motion.js';
import { textRole } from '../internal/control-styles.js';
import { POP_TUNE, popLook, type PopPose } from '../internal/field-motion.js';
import { iconX } from '../internal/icons.js';
import { SpringMotion } from '../internal/spring-motion.js';
import { TextControl } from '../internal/text-control.js';

/** Space between an affix and the text (px). */
const AFFIX_GAP = 8;

/**
 * A single-line text input. Covers text, email, url and tel via `type`.
 * Passwords, search and one-time codes have their own components.
 *
 * With `floating`, the label rests inside the field and floats onto its top
 * edge on focus or once there is a value. `clearable` adds a clear button
 * while there is a value. `prefix` and `suffix` slots hold short decorative
 * text or an icon (a currency sign, a unit); put anything the user needs in
 * the label or description, since an affix is not part of the input's name.
 *
 * @tag prism-text-input
 * @slot prefix - Short text or an icon before the value.
 * @slot suffix - Short text or an icon after the value.
 * @slot description - Helper text, announced with the input.
 * @slot error - Error text, shown in the MessageBox when invalid.
 * @csspart label - The label.
 * @csspart control - Wrapper around the native input.
 * @csspart input - The native input.
 * @csspart prefix - Wrapper around the prefix slot.
 * @csspart suffix - Wrapper around the suffix slot.
 * @csspart clear - The clear button.
 * @csspart description - Wrapper around the description slot.
 * @csspart message-box - MessageBox.
 * @cssstate invalid - Fails validation (after interaction or submit).
 * @cssstate disabled - Disabled (own or via fieldset).
 * @cssstate floated - With `floating`: the label sits on the top edge.
 * @fires input - Native input event (composed).
 * @fires change - Committed value change.
 */
export class PrismTextInput extends TextControl {
  static override styles: CSSResultGroup = [
    TextControl.styles,
    css`
      [part='input'] {
        padding-inline-start: calc(
          var(--prism-control-padding-inline, 0.75rem) + var(--_prefix-w, 0px)
        );
        padding-inline-end: calc(
          var(--prism-control-padding-inline, 0.75rem) + var(--_suffix-w, 0px) +
            var(--_clear-w, 0px)
        );
      }
      :host([clearable]) {
        --_clear-w: 24px;
      }
      [part='prefix'],
      [part='suffix'] {
        position: absolute;
        inset-block: 0;
        z-index: 2; /* above the input (themes raise it to z 1) */
        display: flex;
        align-items: center;
        pointer-events: none;
        ${textRole('body')}
      }
      [part='prefix'] {
        inset-inline-start: var(--prism-control-padding-inline, 0.75rem);
      }
      [part='suffix'] {
        inset-inline-end: var(--prism-control-padding-inline, 0.75rem);
      }
      [part='prefix'][hidden],
      [part='suffix'][hidden] {
        display: none;
      }
      [part='clear'] {
        inset-inline-end: calc(
          var(--prism-control-padding-inline, 0.75rem) / 2 +
            var(--_suffix-w, 0px)
        );
      }
    `,
  ];

  /** Native input type. Use the dedicated components for password/search/OTP. */
  @property() type: 'text' | 'email' | 'url' | 'tel' = 'text';
  /** Virtual keyboard hint, passed through. */
  @property() inputmode = '';
  /** Regular expression the value must match (native semantics). */
  @property() pattern = '';
  /** Shows a clear button while there is a value. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** Accessible name of the clear button. */
  @property({ attribute: 'clear-label' }) clearLabel = 'Clear';

  @state() private hasPrefix = false;
  @state() private hasSuffix = false;

  protected override supportsFloating = true;

  #clearShown = false;
  readonly #clearPop = new SpringMotion<'s', 'button'>(
    ['s'],
    { button: { el: () => this.renderRoot?.querySelector('[part="clear"]') } },
    (pose) => ({ button: popLook(pose) }),
  );
  readonly #sizes = new ResizeObserver(() => this.#measure());

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#sizes.disconnect();
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    // Something sits where the label would rest: keep it on the edge. Read
    // from the light DOM so the first render already knows.
    this.labelPinned =
      this.hasPrefix || this.querySelector(':scope > [slot="prefix"]') !== null;
    super.willUpdate(changed);
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    // An affix can change width on its own (its text changes): watch them.
    for (const part of ['prefix', 'suffix'])
      this.#sizes.observe(this.#part(part)!);
    this.#measure();
    const shown = this.#showClear;
    if (shown && !this.#clearShown) {
      if (canAnimate(this, this.#part('clear'))) {
        this.#clearPop.snap({ s: 0 });
        this.#clearPop.go({ s: 1 } satisfies PopPose, () => POP_TUNE);
      }
    }
    this.#clearShown = shown;
  }

  get #showClear(): boolean {
    return (
      this.clearable && this.value !== '' && !this.readonly && !this.isDisabled
    );
  }

  /** Width of each affix (plus the gap) becomes padding on the input. */
  #measure(): void {
    const width = (part: string, on: boolean): string =>
      on ? `${Math.ceil(this.#part(part)!.offsetWidth) + AFFIX_GAP}px` : '0px';
    const control = this.#part('control')!.style;
    control.setProperty('--_prefix-w', width('prefix', this.hasPrefix));
    control.setProperty('--_suffix-w', width('suffix', this.hasSuffix));
  }

  #part(name: string): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>(`[part="${name}"]`);
  }

  #onAffix(side: 'prefix' | 'suffix', event: Event): void {
    const has =
      (event.target as HTMLSlotElement).assignedElements({ flatten: true })
        .length > 0;
    if (side === 'prefix') this.hasPrefix = has;
    else this.hasSuffix = has;
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

  protected renderControl() {
    const a = this.a11yAttrs;
    const id = this.fieldId;
    return html`<span part="prefix" ?hidden=${!this.hasPrefix}
        ><slot
          name="prefix"
          @slotchange=${(e: Event) => this.#onAffix('prefix', e)}
        ></slot></span
      ><input
        part="input"
        id="${id}-input"
        .type=${this.type}
        .value=${live(this.value)}
        placeholder=${this.placeholder || ''}
        autocomplete=${a.autocomplete}
        inputmode=${this.inputmode || nothing}
        pattern=${this.pattern || nothing}
        minlength=${a.minlength}
        maxlength=${a.maxlength}
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
        ?hidden=${!this.#showClear}
        @pointerdown=${(e: Event) => e.preventDefault()}
        @click=${() => this.#clear()}
      >
        ${iconX()}</button
      ><span part="suffix" ?hidden=${!this.hasSuffix}
        ><slot
          name="suffix"
          @slotchange=${(e: Event) => this.#onAffix('suffix', e)}
        ></slot
      ></span>`;
  }
}
