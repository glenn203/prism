import { LitElement, css, html } from 'lit';

/**
 * Supporting text under the title. NAME SETTLED (CardDescription). Two lines, then clamps with an ellipsis. Secondary
 * colour comes from the theme.
 *
 * @tag prism-card-description
 * @slot - The description text.
 * @csspart text - The clamped text.
 */
export class PrismCardDescription extends LitElement {
  static override styles = css`
    :host {
      /* Supporting style (decided 12/20) on the card (12/20/400, per the spec).
         The existing caption token is 12/16, so this is not a token yet. */
      --_supporting-font-family: var(
        --prism-font-family-sans,
        Inter,
        ui-sans-serif,
        system-ui,
        sans-serif
      );
      --_supporting-font-size: var(--prism-text-caption-font-size, 0.75rem);
      --_supporting-line-height: var(--prism-font-line-height-20, 1.25rem);
      --_supporting-font-weight: var(--prism-font-weight-regular, 400);
      display: block;
      min-inline-size: 0;
      font-family: var(--_supporting-font-family);
      font-size: var(--_supporting-font-size);
      line-height: var(--_supporting-line-height);
      font-weight: var(--_supporting-font-weight);
    }
    :host([hidden]) {
      display: none;
    }
    [part='text'] {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
  `;

  override render() {
    return html`<span part="text"><slot></slot></span>`;
  }
}
