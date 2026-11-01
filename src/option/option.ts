import { LitElement, css } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * One choice inside `prism-select`. It draws nothing: the select reads its
 * `value`, text and flags and renders a native `<option>` for it.
 *
 * @tag prism-option
 * @slot - The option label.
 */
export class PrismOption extends LitElement {
  static override styles = css`
    :host {
      display: none;
    }
  `;

  /** Submitted value. Falls back to the text content. */
  @property() value = '';
  /** Initial selection (like native). */
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Display label override; defaults to the text content. */
  @property() label = '';

  get resolvedValue(): string {
    return this.getAttribute('value') ?? (this.value || this.text);
  }
  get text(): string {
    return this.label || (this.textContent ?? '').trim();
  }

  override updated(): void {
    // The select draws this option, so tell it when a property moved.
    this.dispatchEvent(new Event('prism-option-change', { bubbles: true }));
  }
}
