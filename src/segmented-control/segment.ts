import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';

/**
 * One choice in a `prism-segmented-control`: `<prism-segment value="week">Week</prism-segment>`.
 * The control draws the native radio input and a real `<label>` for it, owns
 * the selected value, the form value and the sliding indicator, and puts this
 * element inside that label. A segment on its own selects nothing.
 *
 * - It holds what the choice says: its text and an optional icon. The text
 *   names the input. An icon-only segment needs `label`, which names the input
 *   instead.
 * - Segments must be direct children of the control.
 * - `checked` is set by the control from its `value`. Set the control's
 *   `value`, not this.
 * - Pressing, colours, motion and forced colors belong to the control (see
 *   `prism-segmented-control`).
 *
 * @tag prism-segment
 * @slot - The label.
 * @slot icon - An icon before the label.
 * @csspart icon - Wraps the icon slot.
 * @csspart label - Wraps the label.
 * @cssstate checked - This segment is picked.
 * @cssstate disabled - This segment is disabled.
 */
export class PrismSegment extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--prism-space-2, 0.5rem);
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    [part='icon'] {
      display: inline-flex;
      flex: none;
      inline-size: 1rem;
      block-size: 1rem;
    }
    [part='icon'] ::slotted(*) {
      inline-size: 100%;
      block-size: 100%;
    }
    [part='icon'][hidden] {
      display: none;
    }
  `;

  /** Value the control takes when this segment is picked. */
  @property() value = '';

  /** The accessible name, for a segment with only an icon. Optional when there is text. */
  @property() label = '';

  /** Picked. Set by the control from its `value`. Reflected. */
  @property({ type: Boolean, reflect: true }) checked = false;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Set by the control: its native input, for `focus()` and `click()`. */
  input: HTMLInputElement | null = null;

  @state() private hasIcon = false;

  readonly #internals = this.attachInternals();

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }

  /** Picks this segment as if the user had pressed it. */
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
        '[prism-segment] An icon-only segment needs `label`: it needs an accessible name.',
        this,
      );
    // The control draws this segment, so tell it when it moved.
    if (['value', 'label', 'disabled'].some((k) => changed.has(k)))
      this.dispatchEvent(new Event('prism-segment-change', { bubbles: true }));
  }

  override render() {
    return html`<span part="icon" aria-hidden="true" ?hidden=${!this.hasIcon}
        ><slot
          name="icon"
          @slotchange=${(e: Event) =>
            (this.hasIcon =
              (e.target as HTMLSlotElement).assignedNodes().length > 0)}
        ></slot></span
      ><span part="label"><slot></slot></span>`;
  }
}
