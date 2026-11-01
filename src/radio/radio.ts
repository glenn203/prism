import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * One choice in a radio group: `<prism-radio value="weekly" label="Weekly">`
 * inside a `<prism-radio-group>`, which draws the native radio input, owns the
 * selected value, the form value and the arrow keys. A radio on its own
 * selects nothing.
 *
 * - It holds what the choice says: `label`, any default-slot content after it,
 *   and `description`. The group puts that text inside the `<label>` of a
 *   native `<input type="radio">`, so it names the input. The radio draws no
 *   control of its own.
 * - Radios must be direct children of the group.
 * - `checked` is set by the group from its `value`. Set the group's `value`,
 *   not this.
 * - Motion, forced colors and sizes belong to the group (see
 *   `prism-radio-group`).
 *
 * @tag prism-radio
 * @slot - Extra label content, shown after `label`.
 * @cssstate checked - This radio is selected.
 * @cssstate disabled - This radio is disabled.
 */
export class PrismRadio extends LitElement {
  static override styles = css`
    :host([hidden]) {
      display: none;
    }
  `;

  /** Selected. Set by the group from its `value`. Reflected. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** Value the group takes when this radio is picked. */
  @property() value = '';

  /** Required. The choice's name: "Weekly". */
  @property() label = '';

  /** Help text under the label. */
  @property() description = '';

  /** Disables this radio. Reflected. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Set by the group: its native input, for `focus()` and `click()`. */
  input: HTMLInputElement | null = null;

  readonly #internals = this.attachInternals();

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }

  /** Picks this radio as if the user had pressed it. */
  override click(): void {
    this.input?.click();
  }

  override willUpdate(): void {
    const states = this.#internals.states;
    for (const [name, on] of [
      ['checked', this.checked],
      ['disabled', this.disabled],
    ] as const)
      if (on) states.add(name);
      else states.delete(name);
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!this.label && !this.textContent?.trim())
      console.error(
        '[prism-radio] `label` is required: a radio needs an accessible name.',
        this,
      );
    // The group draws this radio, so tell it when the content or state moved.
    if (
      ['value', 'label', 'description', 'disabled'].some((k) => changed.has(k))
    )
      this.dispatchEvent(new Event('prism-radio-change', { bubbles: true }));
  }

  override render() {
    return html`<span>${this.label}</span><slot></slot>`;
  }
}
