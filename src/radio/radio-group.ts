import { LitElement, css, html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { choiceControlStyles } from '../internal/choice-styles.js';
import { textRole } from '../internal/control-styles.js';
import {
  fieldPartsStyles,
  renderDescription,
  renderError,
  syncFieldA11y,
} from '../internal/field-parts.js';
import { FieldValidityController } from '../internal/field-validity.js';
import { FormAssociated } from '../internal/form-associated.js';
import { uniqueId } from '../internal/ids.js';
import { stateLayer } from '../internal/state-layer.js';
import type { PrismRadio } from './radio.js';
import { RadioOption } from './radio-option.js';

/**
 * A group of radios where exactly one can be picked, and the value of the
 * pick is what the form submits.
 *
 * - A native `<fieldset>` with a `<legend>` carrying `label`. Put help text in
 *   the `description` slot and the message for a failed check in the `error`
 *   slot.
 * - Each child `prism-radio` is drawn as a native `<input type="radio">` with
 *   a real `<label>`, all in this one shadow root so they share a name. Tab
 *   stop, arrow keys and Space are the browser's, with no key handling here.
 *   Chrome and Firefox wrap round at the ends and flip Left and Right in
 *   right-to-left text; WebKit does neither, as for any native radios.
 *   A radio's `slot` attribute is used by the group while it is a child, and
 *   put back when it leaves.
 * - `value` is the picked radio's `value` (empty: none). It is what is
 *   submitted under `name`; the inputs are in shadow DOM, so the group mirrors
 *   the value and validity through ElementInternals. `required` fails
 *   validation while none is picked. A radio with `checked` in the markup sets
 *   the starting value. Resets to the starting value with the form.
 * - Fires `input` and `change` after each user pick.
 * - Disabling the group disables every radio in it.
 * - Motion: pressing squishes the dot's box; the dot springs in with a
 *   gentle overshoot as the ring turns to the accent, about 400ms. The radio
 *   that was selected shrinks its dot out at the same moment, and an arrow-key
 *   move animates the same way. A tap during a move turns it round from where
 *   it is, with its speed. Only transform and opacity move. Nothing animates
 *   on first paint; a change from code moves the same way as a click. Under
 *   `prefers-reduced-motion: reduce` the state changes at once and the colour
 *   fades over 120ms.
 * - State is never colour alone: the dot is drawn inside the ring.
 * - The hover, selected and pressed fills come from the shared state layer.
 * - Each radio's parts also carry `checked` and `disabled` while they apply,
 *   so a theme can target `::part(edge disabled)`.
 *
 * @tag prism-radio-group
 * @slot - The `prism-radio` choices.
 * @slot description - Help text under the label.
 * @slot error - Message shown while the group is invalid.
 * @csspart group - The fieldset.
 * @csspart label - The group's legend.
 * @csspart description - The group's help text.
 * @csspart options - Wraps the radios.
 * @csspart option - Wraps one radio's control and text.
 * @csspart control - Wraps a radio's input and drawn box; the 24px minimum hit area.
 * @csspart base - A native radio input, laid over its control; it carries the focus ring.
 * @csspart box - The drawn circle (squishes while pressed).
 * @csspart edge - The resting border.
 * @csspart ring - The accent border, shown while selected.
 * @csspart dot - The selected dot.
 * @csspart option-text - A radio's label column.
 * @csspart option-label - A radio's label.
 * @csspart option-description - A radio's help text.
 * @csspart error - The error message.
 * @cssstate disabled - The group is disabled.
 * @cssstate invalid - Fails validation (after interaction or submit).
 * @fires input - After the user picks a radio.
 * @fires change - After the user picks a radio.
 */
export class PrismRadioGroup extends FormAssociated(LitElement) {
  static override styles = [
    fieldPartsStyles,
    choiceControlStyles,
    css`
      [part~='group'] {
        min-inline-size: 0;
        margin: 0;
        padding: 0;
        border: 0;
      }
      [part~='label'] {
        padding: 0;
      }
      [part~='options'] {
        display: flex;
        flex-direction: column;
        gap: var(--prism-space-2, 0.5rem);
        margin-block-start: var(--prism-space-2, 0.5rem);
      }
      :host([orientation='horizontal']) [part~='options'] {
        flex-flow: row wrap;
        gap: var(--prism-space-2, 0.5rem) var(--prism-space-6, 1.5rem);
      }
      [part~='option'] {
        display: grid;
        grid-template-columns: auto 1fr;
        column-gap: var(--prism-space-3, 0.75rem);
        align-items: start;
      }
      /* The input fills the control and is invisible; the box is drawn above it. */
      [part~='base'],
      [part~='box'] {
        grid-area: 1 / 1;
      }
      [part~='ring'] {
        opacity: 0;
      }
      [part~='dot'] {
        position: absolute;
        inset: 25%;
        border-radius: 50%;
        transform: scale(0);
        opacity: 0;
      }
      [part~='option-text'] {
        min-inline-size: 0;
        padding-block-start: calc((var(--_hit) - 1.25rem) / 2);
      }
      [part~='option-label'] {
        ${textRole('body')}
        display: block;
        cursor: var(--prism-choice-cursor, pointer);
        user-select: none;
      }
      [part~='option-label'][part~='disabled'] {
        cursor: var(--prism-choice-cursor-disabled, default);
      }
      [part~='option-description'] {
        ${textRole('caption')}
      }
    `,
    stateLayer("[part~='control']"),
    // After the state layer: its overlay is drawn by the box, above the ring.
    css`
      [part~='control'] {
        background-image: none;
      }
    `,
  ];

  /** The picked radio's `value`; empty when none is picked. */
  @property({ reflect: true }) value = '';

  /** Required. What the choice is: "Delivery speed". */
  @property() label = '';

  /** A pick is required for the form to submit. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Layout of the radios: stacked (default) or in a row. */
  @property({ reflect: true }) orientation: 'vertical' | 'horizontal' =
    'vertical';

  /** Size of every radio: sm, md or lg. */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';

  @query('[part~="group"]') private readonly group!: HTMLFieldSetElement;

  readonly #id = uniqueId('prism-radio-group');
  readonly #validity = new FieldValidityController(this);
  readonly #options = new Map<PrismRadio, RadioOption>();
  /** What each radio's `slot` attribute was before the group took it over. */
  readonly #authorSlots = new Map<PrismRadio, string | null>();
  #radios: PrismRadio[] = [];
  #defaultValue = '';
  #adopted = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('prism-radio-change', this.#redraw);
    for (const option of this.#options.values()) option.snap();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('prism-radio-change', this.#redraw);
    for (const option of this.#options.values()) option.stop();
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    this.#validity.touch();
    return this.internals.reportValidity();
  }

  formResetCallback(): void {
    this.value = this.#defaultValue;
    this.#validity.reset();
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    this.value = typeof state === 'string' ? state : '';
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    this.#readRadios();
    if (changed.has('value'))
      this.internals.setFormValue(this.value || null, this.value);
  }

  override updated(): void {
    if (!this.label)
      console.error(
        '[prism-radio-group] `label` is required: a group needs an accessible name.',
        this,
      );
    this.internals.setValidity(
      this.required && !this.value ? { valueMissing: true } : {},
      'Pick one of these choices to continue.',
      this.#radios.length ? (this.#radios[0]?.input ?? this.group) : this.group,
    );
    syncFieldA11y(
      this.renderRoot,
      this.group,
      this.#id,
      this.#validity.sync(),
      {
        ariaInvalid: false,
      },
    );
    for (const option of this.#options.values()) option.settle();
  }

  /**
   * Reads the child radios: gives each a slot of its own (the group puts it
   * inside that radio's `<label>`), pushes the picked state into it, and sets
   * the starting value from a radio marked `checked` in the markup, once.
   */
  #readRadios(): void {
    this.#radios = [
      ...this.querySelectorAll<PrismRadio>(':scope > prism-radio'),
    ];
    if (!this.#adopted && this.#radios.length) {
      this.#adopted = true;
      if (!this.value)
        this.value = this.#radios.find((r) => r.checked)?.value ?? '';
      this.#defaultValue = this.value;
    }
    for (const radio of this.#radios) {
      radio.checked = this.#isPicked(radio);
      if (!this.#options.has(radio)) this.#addOption(radio);
    }
    for (const [radio, option] of this.#options)
      if (!this.#radios.includes(radio)) {
        option.stop();
        this.#options.delete(radio);
        this.#releaseSlot(radio);
      }
  }

  #addOption(radio: PrismRadio): void {
    this.#authorSlots.set(radio, radio.getAttribute('slot'));
    radio.slot = uniqueId('prism-option');
    this.#options.set(
      radio,
      new RadioOption(
        this,
        radio,
        () => this.#isPicked(radio),
        () => this.#isOff(radio),
      ),
    );
  }

  /** A radio that leaves the group gets its own `slot` back. */
  #releaseSlot(radio: PrismRadio): void {
    const own = this.#authorSlots.get(radio);
    if (own === null || own === undefined) radio.removeAttribute('slot');
    else radio.setAttribute('slot', own);
    this.#authorSlots.delete(radio);
  }

  #isPicked(radio: PrismRadio): boolean {
    return this.value !== '' && radio.value === this.value;
  }

  #isOff(radio: PrismRadio): boolean {
    return radio.disabled || this.isDisabled;
  }

  /** A radio was added, removed or changed: draw again. */
  #redraw = (): void => this.requestUpdate();

  /** The native `input` event reaches the host as it is; take the value first. */
  #onInput(radio: PrismRadio): void {
    this.value = radio.value;
    this.#validity.touch();
  }

  /** A native `change` stays inside the shadow root, so say it again on the host. */
  #onChange(): void {
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  #onFocusOut = (event: FocusEvent): void => {
    if (!this.group.contains(event.relatedTarget as Node | null))
      this.#validity.touch();
  };

  #renderOption(radio: PrismRadio) {
    const option = this.#options.get(radio)!;
    const press = option.press;
    const rest = option.rest;
    const id = radio.slot;
    const off = this.#isOff(radio);
    const state = `${this.#isPicked(radio) ? ' checked' : ''}${off ? ' disabled' : ''}`;
    return html`<div part="option" ${ref(option.attachRoot)}>
      <span part="control">
        <input
          part="base"
          id=${id}
          type="radio"
          name=${this.#id}
          aria-describedby=${radio.description ? `${id}-description` : nothing}
          .checked=${this.#isPicked(radio)}
          ?required=${this.required}
          ?disabled=${off}
          ${ref(option.attachInput)}
          @input=${() => this.#onInput(radio)}
          @change=${() => this.#onChange()}
          @keydown=${press.down}
          @keyup=${press.up}
          @blur=${press.up}
          @pointerdown=${press.down}
          @pointerup=${press.up}
          @pointercancel=${press.up}
          @pointerleave=${press.up}
        />
        <span part="box" style=${styleMap(rest.box)}>
          <span part="edge${state}"></span>
          <span part="ring${state}" style=${styleMap(rest.ring)}></span>
          <span part="dot${state}" style=${styleMap(rest.dot)}></span>
        </span>
      </span>
      <div part="option-text">
        <label part="option-label${state}" for=${id}
          ><slot name=${id} @slotchange=${this.#redraw}></slot
        ></label>
        ${
          radio.description
            ? html`<div
                part="option-description${state}"
                id="${id}-description"
              >
                ${radio.description}
              </div>`
            : nothing
        }
      </div>
    </div>`;
  }

  override render() {
    return html`<fieldset part="group" @focusout=${this.#onFocusOut}>
      <legend part="label">${this.label}</legend>
      ${renderDescription(this.#id)}
      <div part="options">
        ${repeat(
          this.#radios,
          (radio) => radio,
          (radio) => this.#renderOption(radio),
        )}
        <slot @slotchange=${this.#redraw}></slot>
      </div>
      ${renderError(this.#id)}
    </fieldset>`;
  }
}
