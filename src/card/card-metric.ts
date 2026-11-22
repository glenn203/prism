import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * A big number for a widget, with an optional label. NAME PROVISIONAL.
 *
 * The number uses the PROPOSED metric text style: 28px / 36px, weight 600,
 * tabular figures, built from existing primitives. The spec leaves the
 * real size, weight and line height to Typography, which has not been edited,
 * so this is a stand-in set in component-private `--_metric-*` properties
 * (never from outside). No Display style is used inside a card.
 *
 * Reading order is number first, then the label, so a screen reader says
 * "1,284 items". Put a time range in the label only if the number is
 * specific to it; the widget header already shows an overridden range.
 *
 * @tag prism-card-metric
 * @slot - The number, already formatted for the reader's locale.
 * @csspart value - The number.
 * @csspart label - The label under the number.
 */
export class PrismCardMetric extends LitElement {
  static override styles = css`
    :host {
      /* PROPOSED text.metric (28/36/600, tabular). Not in tokens/*.json. */
      --_metric-font-family: var(
        --prism-font-family-sans,
        Inter,
        ui-sans-serif,
        system-ui,
        sans-serif
      );
      --_metric-font-size: var(--prism-text-heading-1-font-size, 1.75rem);
      --_metric-line-height: var(--prism-font-line-height-36, 2.25rem);
      --_metric-font-weight: var(--prism-font-weight-semibold, 600);
      /* Supporting style (decided 12/20) (12/20/400), as the card meta. */
      --_supporting-font-size: var(--prism-text-caption-font-size, 0.75rem);
      --_supporting-line-height: var(--prism-font-line-height-20, 1.25rem);
      --_supporting-font-weight: var(--prism-font-weight-regular, 400);
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    [part='value'] {
      font-family: var(--_metric-font-family);
      font-size: var(--_metric-font-size);
      line-height: var(--_metric-line-height);
      font-weight: var(--_metric-font-weight);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    [part='label'] {
      font-family: var(--_metric-font-family);
      font-size: var(--_supporting-font-size);
      line-height: var(--_supporting-line-height);
      font-weight: var(--_supporting-font-weight);
    }
    [part='label'][hidden] {
      display: none;
    }
  `;

  /** What the number counts, for example "Items". */
  @property() label = '';

  override render() {
    return html`<div part="value"><slot></slot></div>
      <div part="label" ?hidden=${!this.label}>${this.label}</div>`;
  }
}
