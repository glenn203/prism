import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * A loading placeholder: grey lines where text will be. NAME PROVISIONAL (the Skeleton component is not
 * built yet, so this is card-private and swappable).
 *
 * It is decorative: `aria-hidden`, never focusable. The loading state is
 * announced as text by whatever owns it (a card or a card list), so the
 * skeleton never carries information on its own.
 *
 * - `variant="text"` (default): `lines` lines of text.
 * - `variant="card"`: a whole card the same size as a real one (title line,
 *   description line, two content lines, a footer line).
 *
 * Colour and the shimmer live in the opt-in theme (reduced motion removes the
 * shimmer there).
 *
 * @tag prism-card-skeleton
 * @csspart base - The skeleton surface.
 * @csspart line - One line.
 */
export class PrismCardSkeleton extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    [part='base'] {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: var(--prism-space-2, 0.5rem);
      block-size: 100%;
    }
    :host([variant='card']) [part='base'] {
      /* Same padding as the card, so heights match a real one. */
      padding: calc(
        var(--prism-unit, 0.25rem) * (var(--prism-density-pad-units, 2) + 2)
      );
      min-block-size: 10rem;
      gap: var(--prism-space-3, 0.75rem);
    }
    [part='line'] {
      display: block;
      block-size: 0.75rem;
      inline-size: 100%;
    }
    [part='line']:last-child {
      inline-size: 60%;
    }
    :host([variant='card']) [part='line']:first-child {
      inline-size: 45%;
      block-size: 0.875rem;
    }
    :host([variant='card']) [part='line'][data-prism-footer] {
      margin-block-start: auto;
      inline-size: 30%;
    }
  `;

  @property({ reflect: true }) variant: 'text' | 'card' = 'text';
  /** Text variant only. */
  @property({ type: Number }) lines = 3;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  override render() {
    if (this.variant === 'card')
      return html`<div part="base">
        <span part="line"></span><span part="line"></span>
        <span part="line"></span><span part="line"></span>
        <span part="line" data-prism-footer></span>
      </div>`;
    const n = Math.max(1, Math.min(8, Math.round(this.lines) || 3));
    return html`<div part="base">
      ${Array.from({ length: n }, () => html`<span part="line"></span>`)}
    </div>`;
  }
}
