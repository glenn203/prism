import { LitElement, css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import '../menu/define.js';
import {
  applyViolations,
  validateActions,
  type ActionsPlacement,
} from './card-slots.js';
import { CARD_NARROW_PX, type PrismCard } from './card.js';

/**
 * A group of card actions. NAME PROVISIONAL.
 *
 * Where it sits decides its rules (from its `slot`):
 * - `slot="header"`: up to two ghost `prism-icon-button`s, or one overflow
 *   `prism-menu`. No text buttons. On a narrow card the icon buttons fold into
 *   one overflow menu († narrow rule: page says "about 280px or less").
 * - `slot="footer"`: up to two `prism-button`s, ghost or secondary (soft),
 *   plus one primary only on a `standalone` card. A "View all" link counts as
 *   one. Medium size (small in a widget footer), 8px apart, at the end (mirrors in right-to-left).
 * - no slot (content-only card): the last row of the content, at the end,
 *   medium size, 8px apart, ghost and secondary only. Soft goes on the right,
 *   ghost to its left (put the ghost button first in the DOM). The row wraps
 *   to the next line on the end side and sits at the bottom of the card.
 *
 * Invalid children are hidden with a dev error.
 *
 * @tag prism-card-actions
 * @slot - The buttons.
 */
export class PrismCardActions extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--prism-space-2, 0.5rem);
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    :host([slot='header']) {
      flex-wrap: nowrap;
    }
    /* Content-only row: last in the content, pinned to the bottom, with a
       12px minimum gap above it. Not absolutely positioned. */
    :host(:not([slot])) {
      margin-block-start: auto;
      padding-block-start: var(--prism-space-3, 0.75rem);
    }
    ::slotted([data-prism-invalid]) {
      display: none !important;
    }
    :host(:state(folded)) ::slotted(prism-icon-button) {
      display: none;
    }
  `;

  @state() private narrow = false;
  @state() private folded: { label: string; button: HTMLElement }[] = [];

  readonly #internals = this.attachInternals();
  #observer?: MutationObserver;
  #resize?: ResizeObserver;
  #scheduled = false;

  get placement(): ActionsPlacement {
    return this.slot === 'header'
      ? 'header'
      : this.slot === 'footer'
        ? 'footer'
        : 'content';
  }

  get #card(): PrismCard | null {
    return this.closest('prism-card');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#observer = new MutationObserver(() => this.#schedule());
    this.#observer.observe(this, {
      childList: true,
      attributes: true,
      attributeFilter: ['slot', 'variant', 'label', 'disabled'],
      subtree: true,
    });
    const card = this.#card;
    if (card && this.placement === 'header') {
      this.#resize = new ResizeObserver(([entry]) => {
        const w = entry?.borderBoxSize?.[0]?.inlineSize ?? card.offsetWidth;
        this.narrow = w > 0 && w <= CARD_NARROW_PX;
        this.#fold();
      });
      this.#resize.observe(card);
    }
    this.#schedule();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#resize?.disconnect();
  }

  /** Re-checks the children (the card calls this when its flags change). */
  revalidate(): void {
    this.#schedule();
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#validate();
    });
  }

  #validate(): void {
    const children = [...this.children];
    const card = this.#card;
    const violations = validateActions(
      this.placement,
      children,
      card?.capabilities ?? {
        standalone: false,
        selectable: false,
        draggable: false,
        widget: false,
      },
    );
    applyViolations(children, violations);
    // Footer and content rows are medium, except a widget footer ("View all"),
    // which is small. Normalise so the rule can't drift.
    if (this.placement !== 'header') {
      const size =
        this.placement === 'footer' && card?.capabilities.widget ? 'sm' : 'md';
      for (const c of children)
        if (c.localName === 'prism-button' && c.getAttribute('size') !== size)
          c.setAttribute('size', size);
    }
    this.#applyOrder(children);
    this.#fold();
  }

  /** Soft sits right, ghost left, even if the DOM order is wrong. */
  #applyOrder(children: Element[]): void {
    if (this.placement !== 'content') return;
    for (const c of children as HTMLElement[]) {
      const v = c.getAttribute('variant');
      c.style.order = v === 'secondary' ? '1' : '0';
    }
  }

  /** † Narrow header: icon buttons fold into one overflow menu. */
  #fold(): void {
    const buttons = [...this.children].filter(
      (c): c is HTMLElement =>
        c.localName === 'prism-icon-button' &&
        !c.hasAttribute('data-prism-invalid'),
    );
    const hasMenu = [...this.children].some(
      (c) => c.localName === 'prism-menu',
    );
    const fold = this.narrow && buttons.length > 0 && !hasMenu;
    this.folded = fold
      ? buttons.map((b) => ({
          label: b.getAttribute('label') ?? '',
          button: b,
        }))
      : [];
    try {
      if (fold) this.#internals.states.add('folded');
      else this.#internals.states.delete('folded');
    } catch {
      /* :state() unsupported */
    }
  }

  #cardTitle(): string {
    return (
      this.#card
        ?.querySelector(':scope > prism-card-title')
        ?.textContent?.trim() ?? ''
    );
  }

  override render() {
    const title = this.#cardTitle();
    return html`<slot @slotchange=${() => this.#schedule()}></slot> ${
        this.folded.length
          ? html`<prism-menu
              part="overflow"
              size="sm"
              label=${title ? `More options for ${title}` : 'More options'}
              @prism-menu-select=${(e: CustomEvent<{ item: HTMLElement }>) =>
                this.folded[
                  Number(e.detail.item.dataset['prismIndex'])
                ]?.button.click()}
            >
              ${this.folded.map(
                (f, i) =>
                  html`<prism-menu-item
                    data-prism-index=${i}
                    ?disabled=${f.button.hasAttribute('disabled')}
                    >${f.label}</prism-menu-item
                  >`,
              )}
            </prism-menu>`
          : nothing
      }`;
  }
}
