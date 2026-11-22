import { LitElement, css, html } from 'lit';

/**
 * Footer meta: a timestamp, a count, an owner, or a Tag or Badge. One line,
 * supporting style, ellipsis. NAME PROVISIONAL.
 *
 * @tag prism-card-meta
 * @slot - The meta text.
 */
export class PrismCardMeta extends LitElement {
  static override styles = css`
    :host {
      /* Supporting style (decided 12/20) (12/20/400), see prism-card-description. */
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
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-family: var(--_supporting-font-family);
      font-size: var(--_supporting-font-size);
      line-height: var(--_supporting-line-height);
      font-weight: var(--_supporting-font-weight);
    }
    :host([hidden]) {
      display: none;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}
