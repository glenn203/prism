import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { textRole } from '../internal/control-styles.js';
import { visuallyHidden } from '../internal/visually-hidden.js';

export type MessageBoxPlacement = 'top' | 'bottom';
/** Intent of the message: `error` (default) or `info`. */
export type MessageBoxIntent = 'error' | 'info';
export type MessageBoxAnnounce = 'polite' | 'assertive' | 'off';

const SHIPPED_INTENTS = new Set<MessageBoxIntent>(['error', 'info']);
const PLACEMENTS = new Set<MessageBoxPlacement>(['top', 'bottom']);
const ANNOUNCES = new Set<MessageBoxAnnounce>(['polite', 'assertive', 'off']);

/**
 * A short text box that tucks against a neighbor on one side. The host is
 * the painted box; there is no inner part. Error uses a fill, a matching
 * border and on-fill text. Info uses a neutral tint and muted text, with
 * no border.
 *
 * @tag prism-message-box
 * @slot - The message text only. Required to show the box.
 * @cssprop [--prism-message-box-inset=0] - How far the box sits inside the
 *   neighbor. 0 is flush with the neighbor's outer edge. Fillets are
 *   min(inset, radius-5).
 * @cssprop [--prism-color-message-box-tint] - Info fill (a neutral wash).
 * @cssprop [--prism-color-danger-border] - Error border; matches the fill.
 * @cssprop [--prism-color-text-muted] - Info text (secondary / supporting).
 */
export class PrismMessageBox extends LitElement {
  static override styles = [
    visuallyHidden,
    css`
      :host {
        --_prism-status-overlap: calc(var(--prism-space-1, 0.25rem) / 2);
        --_prism-message-box-fillet: min(
          var(--prism-message-box-inset, 0),
          var(--prism-radius-5, 5px)
        );
        box-sizing: border-box;
        display: block;
        position: relative;
        min-inline-size: 0;
        overflow-wrap: anywhere;
        pointer-events: none;
        ${textRole('supporting')}
      }
      :host([hidden]),
      :host(:state(empty)) {
        display: none;
      }
      @media (forced-colors: active) {
        :host {
          border: var(--prism-border-width, 1px) solid CanvasText;
          background: Canvas;
          color: CanvasText;
        }
        :host::before,
        :host::after {
          background: Canvas;
        }
      }
    `,
  ];

  /**
   * Which edge tucks against the neighbor. `top` goes before the neighbor
   * in the DOM; `bottom` (the default) goes after.
   */
  @property({ reflect: true }) placement: MessageBoxPlacement = 'bottom';

  /** Colour family for the box: `error` (default) or `info`. */
  @property({ reflect: true }) intent: MessageBoxIntent = 'error';

  /** How (or whether) a live region announces the text. */
  @property({ reflect: true }) announce: MessageBoxAnnounce = 'polite';

  @state() private message = '';

  readonly #internals = this.attachInternals();

  override willUpdate(): void {
    if (!PLACEMENTS.has(this.placement)) this.placement = 'bottom';
    if (!SHIPPED_INTENTS.has(this.intent)) this.intent = 'error';
    if (!ANNOUNCES.has(this.announce)) this.announce = 'polite';
    this.#syncEmpty(this.message);
  }

  override firstUpdated(): void {
    const slot = this.renderRoot.querySelector('slot');
    if (slot) this.#readSlot(slot);
  }

  #onSlotChange(event: Event): void {
    this.#readSlot(event.target as HTMLSlotElement);
  }

  #readSlot(slot: HTMLSlotElement): void {
    const text = slot
      .assignedNodes({ flatten: true })
      .map((node) => node.textContent ?? '')
      .join('')
      .trim();
    this.message = text;
    this.#syncEmpty(text);
  }

  #syncEmpty(text: string): void {
    const empty = text.length === 0;
    try {
      if (empty) this.#internals.states.add('empty');
      else this.#internals.states.delete('empty');
    } catch {
      /* :state() unsupported */
    }
  }

  override render() {
    const live =
      this.announce === 'off'
        ? nothing
        : html`<output class="visually-hidden" aria-live=${this.announce}
            >${this.message}</output
          >`;
    return html`${live}<slot @slotchange=${this.#onSlotChange}></slot>`;
  }
}
