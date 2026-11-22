import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * One term and definition of a `prism-description-list`. The default slot is
 * the value (text, a tag, a link). NAME PROVISIONAL.
 *
 * The host uses `display: contents` so the `<dt>` and `<dd>` participate in
 * the parent list's grid.
 *
 * @tag prism-description-list-item
 * @slot - The value.
 * @csspart label - The term (`<dt>`).
 * @csspart value - The definition (`<dd>`).
 */
export class PrismDescriptionListItem extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }
    :host([hidden]) {
      display: none;
    }
    [part='label'],
    [part='value'] {
      margin: 0;
    }
    [part='value'] {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
  `;

  /** The term: "Version", "OS". */
  @property() label = '';

  override updated(): void {
    if (!this.label)
      console.error('[prism-description-list-item] `label` is required.', this);
  }

  override render() {
    return html`<dt part="label">${this.label}</dt>
      <dd part="value"><slot></slot></dd>`;
  }
}
