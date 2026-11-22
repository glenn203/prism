import { css, html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { PrismCardGroup } from './card-group.js';
import { devError } from './card-slots.js';
import { authored, renderLight } from './light-dom.js';
import type { PrismCard } from './card.js';
import type { PrismCardHandle } from './card-handle.js';
import { reorderMessages } from './card-announcer.js';
import { iconGrip } from '../internal/icons.js';
import {
  ReorderDrag,
  REORDER_COPY_MAX_PX,
  type DropIndicator,
  type DropPoint,
  type ReorderTarget,
} from '../internal/reorder.js';

type MoveDir = 'top' | 'up' | 'down' | 'bottom';
interface MoveSpec {
  dir: MoveDir;
  text: string;
  name: string;
  disabled: boolean;
}
/** Controls that make a card "have other controls" (so it drags by handle only). */
const OTHER_CONTROLS =
  'a[href], button, input, select, textarea, prism-button, prism-icon-button, prism-menu, prism-card-select, prism-card-title[href], prism-card-title[action]';

/** The Move menu items. Wording from the card spec; a grid reads start/end. */
export function moveSpecs(
  grid: boolean,
  title: string,
  index: number,
  count: number,
): MoveSpec[] {
  const first = index <= 0;
  const last = index >= count - 1;
  const words: [MoveDir, string, boolean][] = grid
    ? [
        ['top', 'Move to start', first],
        ['up', 'Move earlier', first],
        ['down', 'Move later', last],
        ['bottom', 'Move to end', last],
      ]
    : [
        ['top', 'Move to top', first],
        ['up', 'Move up', first],
        ['down', 'Move down', last],
        ['bottom', 'Move to bottom', last],
      ];
  // The visible text stays the start of the name (WCAG 2.5.3); the card follows.
  return words.map(([dir, text, disabled]) => ({
    dir,
    text,
    name: `${text}, ${title}`,
    disabled,
  }));
}

/** Page sizes the card spec names ("Common page sizes are 12, 24 and 48"). */
export const CARD_LIST_PAGE_SIZES = [12, 24, 48] as const;
export type CardListPageSize = (typeof CARD_LIST_PAGE_SIZES)[number];
/** PROPOSED (page: "Cards stay at least 280px wide"). */
export const CARD_LIST_MIN_PX = 280;

type ListState = 'loading' | 'refreshing' | 'empty' | 'no-matches' | 'error';

/**
 * A grid or single-column list of cards, with paging, selection that is kept
 * across pages, and the loading, empty and error states. NAME PROVISIONAL. Section owns these states on a real page; this element
 * gives them a default look and fires events so a Section can take over.
 *
 * ```html
 * <prism-card-list label="Resources" selection="multi" total="120" page="2">
 *   <prism-card type="selectable" kind="collection" value="h-13">…</prism-card>
 * </prism-card-list>
 * ```
 *
 * - **Layout.** Columns follow the list's own width (a container query), not
 *   the screen: under 640px one column, 640 to 1023 two, 1024 to 1279 three,
 *   1280 and up four. Cards stay at least 280px wide, the gap is space-4 (16px)
 *   and cards in a row share a height. `columns="1"` pins one column (Aside,
 *   Drawer, Modal). No masonry.
 * - **Semantics.** An inner wrapper around the cards is the labelled `list` and
 *   each card a `listitem` (the card sets its own role). The host has no role,
 *   so the selected count, pager and status region sit outside the list. Titles stay real headings: give every card
 *   the same `level`, one below the Section heading. With `total` set, each
 *   card gets `aria-posinset` and `aria-setsize` from the data, not from what
 *   is on the page.
 * - **Paging.** Server-side: you swap the children when `prism-card-list-page`
 *   fires. `page-size` is 12, 24 or 48 (default 24). The pager shows even when
 *   there is one page. A `pagination` slot replaces it with a real Pagination
 *   component; `load-more` shows a "Load more" button instead.
 * - **Selection** uses the same cards, `value` ids and controller as
 *   `prism-card-group`, multi only (use a group for a single choice). Ids not
 *   on screen stay selected when the page changes; a visible "N selected" and
 *   "Clear selection" sit above the cards unless `hide-selection-bar` is set
 *   or you fill the `toolbar` slot.
 * - **States** (`state`): `loading` (skeleton cards, list busy, polite
 *   "Loading"), `refreshing` (cards stay, quiet busy line), `empty` (fill the
 *   `empty` slot), `no-matches` ("No matches" and Clear filters), `error`
 *   (what failed and Retry). A single failed card uses `state="error"` on the
 *   card itself.
 *
 * @tag prism-card-list
 * - **Reordering** (`reorderable`): cards get a drag handle first in the header
 *   (`prism-card-handle`). Drag with the pointer (touch: press and hold the
 *   handle); the original dims, a copy follows, a line shows the drop point.
 *   Every card also gets Move items (top, up, down, bottom; start, earlier,
 *   later, end in a grid) in its overflow menu, or in the handle itself when it
 *   has no overflow menu, so nothing needs a drag (WCAG 2.5.7). The list
 *   announces moves in one polite live region and fires `prism-card-reorder`;
 *   call `rollback()` if saving fails. `reorder-group` lets cards cross lists.
 *
 * @slot - The cards, all of one type with the same slots.
 * @slot toolbar - Replaces the selected count and Clear selection.
 * @slot pagination - Replaces the built-in pager.
 * @slot empty - First-use empty state: a short title, one sentence, one button.
 * @csspart grid - The grid of cards.
 * @csspart status - The visually hidden live region.
 * @csspart busy - The quiet busy line while refreshing.
 * @csspart drop-line - The drop indicator (a line between cards).
 * @csspart drop-dot - The dot at the start of the drop line.
 * @fires prism-card-list-page - Pager used. `detail: { page, pageSize }`.
 * @fires prism-card-list-load-more - Load more pressed.
 * @fires prism-card-list-retry - Retry pressed in the error state.
 * @fires prism-card-list-clear-filters - Clear filters pressed in no-matches.
 * @fires prism-card-reorder - A card moved. `detail: { value, card, from, to, fromList, toList }` (1-based positions).
 * @fires prism-card-reorder-failed - `rollback()` put a card back; show a Toast.
 */
export class PrismCardList extends PrismCardGroup {
  static override styles = [
    PrismCardGroup.styles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      [part='grid'] {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--prism-space-4, 1rem);
        align-items: stretch;
      }
      /* Columns follow the list's width (same four widths as the page). */
      @container (min-width: 640px) {
        [part='grid'] {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @container (min-width: 1024px) {
        [part='grid'] {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @container (min-width: 1280px) {
        [part='grid'] {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }
      :host([columns='1']) [part='grid'] {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      ::slotted(prism-card),
      ::slotted(prism-card-skeleton) {
        min-inline-size: 0;
      }
      [part='toolbar'],
      [part='pager'],
      [part='state'] {
        display: block;
      }
      [part='toolbar']:not(:has(::slotted(*))),
      [part='pager']:not(:has(::slotted(*))) {
        display: none;
      }
      [part='toolbar'] {
        margin-block-end: var(--prism-space-3, 0.75rem);
      }
      [part='pager'] {
        margin-block-start: var(--prism-space-4, 1rem);
      }
      [part='busy'] {
        display: block;
        block-size: 2px;
        margin-block-end: var(--prism-space-2, 0.5rem);
      }
      [part='busy'][hidden] {
        display: none;
      }
      :host {
        position: relative;
      }
      /* PROPOSED (page: a 2px line with an 8px dot): private sizes. */
      [part='drop-line'] {
        --_drop-line-width: 2px;
        --_drop-dot-size: 8px;
        position: absolute;
        pointer-events: none;
        z-index: 2;
      }
      [part='drop-line'][hidden] {
        display: none;
      }
      [part='drop-line']:not([data-prism-vertical]) {
        block-size: var(--_drop-line-width);
        margin-block-start: calc(var(--_drop-line-width) / -2);
      }
      [part='drop-line'][data-prism-vertical] {
        inline-size: var(--_drop-line-width);
        margin-inline-start: calc(var(--_drop-line-width) / -2);
      }
      [part='drop-dot'] {
        position: absolute;
        inline-size: var(--_drop-dot-size);
        block-size: var(--_drop-dot-size);
        border-radius: 50%;
      }
      [part='drop-line']:not([data-prism-vertical]) [part='drop-dot'] {
        inset-inline-start: 0;
        inset-block-start: calc(
          (var(--_drop-line-width) - var(--_drop-dot-size)) / 2
        );
      }
      [part='drop-line'][data-prism-vertical] [part='drop-dot'] {
        inset-block-start: 0;
        inset-inline-start: calc(
          (var(--_drop-line-width) - var(--_drop-dot-size)) / 2
        );
      }
    `,
  ];

  /** Pins one column ("1") for an Aside, Drawer or Modal. Otherwise automatic. */
  @property({ reflect: true }) columns?: '1';
  /** Current page, starting at 1. Server-side: you swap the children. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Cards per page: 12, 24 or 48. */
  @property({ type: Number, attribute: 'page-size', reflect: true })
  pageSize: number = 24;
  /** Total items across all pages (also sets each card's position and size). */
  @property({ type: Number }) total?: number;
  /** Replaces the pager with a "Load more" button (a feed that grows). */
  @property({ type: Boolean, attribute: 'load-more', reflect: true })
  loadMore = false;
  @property({ reflect: true }) state?: ListState;
  /** The reason for `state="error"`. */
  @property({ attribute: 'state-message' }) stateMessage = '';
  /** How many skeleton cards to show while loading (about eight). */
  @property({ type: Number, attribute: 'skeleton-count' }) skeletonCount = 8;
  /** Hides the built-in "N selected" bar (use your Toolbar instead). */
  @property({ type: Boolean, attribute: 'hide-selection-bar' })
  hideSelectionBar = false;

  /** Cards can be reordered (handle, drag, Move menu). NAME PROVISIONAL. */
  @property({ type: Boolean, reflect: true }) reorderable = false;
  /** Lists with the same group let a card move between them. */
  @property({ attribute: 'reorder-group' }) reorderGroup = '';
  @state() private line: DropIndicator | null = null;

  #hadCards = false;
  #hasItems = false;
  #lastTotal?: number;
  #drag?: ReorderDrag;
  #resize?: ResizeObserver;
  #history?: { card: PrismCard; source: PrismCardList; index: number };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('prism-menu-select', this.#onMenuSelect);
    this.#resize = new ResizeObserver(() => {
      if (this.reorderable) this.#syncReorder();
    });
    this.#resize.observe(this);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('prism-menu-select', this.#onMenuSelect);
    this.#resize?.disconnect();
    this.#drag?.detach();
    this.#drag = undefined;
  }

  /** No role on the host: the `list` is the inner wrapper around the cards. */
  protected override hostRole(): string | null {
    return null;
  }

  protected override synced(): void {
    const cards = this.#items;
    // Position and total come from the data, not from what is on the page.
    const offset = this.loadMore
      ? 0
      : (Math.max(1, this.page) - 1) * this.pageSize;
    cards.forEach((card, i) => {
      if (this.total === undefined && this.reorderable) {
        card.setAttribute('aria-setsize', String(cards.length));
        card.setAttribute('aria-posinset', String(i + 1));
      } else if (this.total === undefined) {
        card.removeAttribute('aria-setsize');
        card.removeAttribute('aria-posinset');
      } else {
        card.setAttribute('aria-setsize', String(this.total));
        card.setAttribute('aria-posinset', String(offset + i + 1));
      }
    });
    const levels = new Set(
      cards
        .map((c) =>
          c.querySelector(':scope > prism-card-title')?.getAttribute('level'),
        )
        .filter(Boolean),
    );
    if (levels.size > 1)
      devError(
        this,
        'Cards in a list share one title level (one below the Section heading); found ' +
          [...levels].join(', ') +
          '.',
      );
    this.#syncReorder();
    if (cards.length > 0 !== this.#hasItems) {
      this.#hasItems = cards.length > 0;
      this.requestUpdate();
    }
    const has = this.cards.length > 0;
    if (has !== this.#hadCards) {
      this.#hadCards = has;
      this.requestUpdate();
    }
  }

  /** The cards, in order (also the reorder items). */
  get cardItems(): PrismCard[] {
    return this.#items;
  }

  get #items(): PrismCard[] {
    return [...this.children].filter(
      (c): c is PrismCard => c.localName === 'prism-card',
    );
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('state')) {
      if (this.state === 'loading') this.message = 'Loading';
      else if (this.state === 'refreshing') this.message = 'Refreshing';
      else if (changed.get('state') !== undefined) this.message = '';
    }
    if (changed.has('total')) {
      if (this.#lastTotal !== undefined && this.total !== undefined)
        this.message = `${this.total} result${this.total === 1 ? '' : 's'}`;
      this.#lastTotal = this.total;
    }
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    if (this.selection === 'single')
      devError(
        this,
        'A card list selects many. Use <prism-card-group selection="single"> for a single choice.',
      );
    if (!(CARD_LIST_PAGE_SIZES as readonly number[]).includes(this.pageSize))
      devError(
        this,
        `page-size is ${CARD_LIST_PAGE_SIZES.join(', ')} (default 24), not ${String(this.pageSize)}.`,
      );
    if (this.columns !== undefined && String(this.columns) !== '1')
      devError(this, '`columns` takes "1" only; other widths are automatic.');
    this.toggleAttribute('aria-busy', false);
    if (this.state === 'loading' || this.state === 'refreshing')
      this.setAttribute('aria-busy', 'true');
    if (changed.has('reorderable')) this.#setupDrag();
    this.synced();
    this.#renderBars();
  }

  /** Everything the list adds itself goes in the light DOM (see light-dom.ts). */
  #renderBars(): void {
    // Selected count + Clear selection.
    const showBar =
      !this.hideSelectionBar &&
      !authored(this, 'toolbar') &&
      (this.#hadCards || this.count > 0);
    renderLight(
      this,
      'toolbar',
      showBar
        ? html`<div data-prism-selection-bar>
            <span data-prism-count tabindex="-1">${this.count} selected</span>
            ${
              this.count > 0
                ? html`<prism-button
                    variant="ghost"
                    size="sm"
                    type="button"
                    @click=${this.#onClear}
                    >Clear selection</prism-button
                  >`
                : null
            }
          </div>`
        : null,
    );

    // Skeleton cards while loading.
    renderLight(
      this,
      'skeleton',
      this.state === 'loading'
        ? html`${Array.from(
            { length: Math.max(1, Math.min(48, this.skeletonCount)) },
            () =>
              html`<prism-card-skeleton variant="card"></prism-card-skeleton>`,
          )}`
        : null,
    );

    // Whole-list states.
    let stateTpl: TemplateResult | null = null;
    if (this.state === 'no-matches')
      stateTpl = html`<div data-prism-list-state="no-matches">
        <p>No matches</p>
        <prism-button
          variant="secondary"
          type="button"
          @click=${() => this.#fire('prism-card-list-clear-filters')}
          >Clear filters</prism-button
        >
      </div>`;
    else if (this.state === 'error')
      stateTpl = html`<div data-prism-list-state="error">
        <p>${this.stateMessage || "The cards couldn't be loaded."}</p>
        <prism-button
          variant="secondary"
          type="button"
          @click=${() => this.#fire('prism-card-list-retry')}
          >Retry</prism-button
        >
      </div>`;
    else if (this.state === 'empty' && !authored(this, 'empty'))
      stateTpl = html`<div data-prism-list-state="empty">
        <p>Nothing here yet</p>
      </div>`;
    renderLight(this, 'state', stateTpl);

    // Pager or Load more.
    let pager: TemplateResult | null = null;
    if (!authored(this, 'pagination')) {
      if (this.loadMore)
        pager = html`<div data-prism-pager>
          <prism-button
            variant="secondary"
            type="button"
            @click=${() => this.#fire('prism-card-list-load-more')}
            >Load more</prism-button
          >
        </div>`;
      else if (this.total !== undefined) {
        const pages = Math.max(1, Math.ceil(this.total / this.pageSize));
        const page = Math.min(Math.max(1, this.page), pages);
        pager = html`<nav aria-label="Pagination" data-prism-pager>
          <prism-button
            variant="ghost"
            size="sm"
            type="button"
            ?disabled=${page <= 1}
            @click=${() => this.#go(page - 1)}
            >Previous</prism-button
          >
          <span data-prism-page>Page ${page} of ${pages}</span>
          <prism-button
            variant="ghost"
            size="sm"
            type="button"
            ?disabled=${page >= pages}
            @click=${() => this.#go(page + 1)}
            >Next</prism-button
          >
          <label data-prism-page-size
            >Per page
            <select @change=${this.#onSize}>
              ${CARD_LIST_PAGE_SIZES.map(
                (n) =>
                  html`<option value=${n} ?selected=${n === this.pageSize}>
                    ${n}
                  </option>`,
              )}
            </select>
          </label>
        </nav>`;
      }
    }
    renderLight(this, 'pagination', pager);
  }

  #fire(name: string, detail?: unknown): void {
    this.dispatchEvent(
      new CustomEvent(name, { bubbles: true, composed: true, detail }),
    );
  }

  #go(page: number): void {
    this.page = page;
    this.#fire('prism-card-list-page', { page, pageSize: this.pageSize });
  }

  #onSize = (event: Event): void => {
    this.pageSize = Number((event.target as HTMLSelectElement).value);
    this.page = 1;
    this.#fire('prism-card-list-page', {
      page: 1,
      pageSize: this.pageSize,
    });
  };

  /** Clear selection: the button disappears, so focus moves to the count. */
  #onClear = async (): Promise<void> => {
    this.clear();
    await this.updateComplete;
    this.querySelector<HTMLElement>('[data-prism-count]')?.focus();
  };

  // ---- Reordering ----------------------------------------------------------

  get #offset(): number {
    return this.total !== undefined && !this.loadMore
      ? (Math.max(1, this.page) - 1) * this.pageSize
      : 0;
  }
  /** 1-based position of the card at in-page index `i`, from the data. */
  #position(i: number): number {
    return this.#offset + i + 1;
  }
  get #count(): number {
    return this.total ?? this.#items.length;
  }

  #isGrid(cards: PrismCard[]): boolean {
    const first = cards[0];
    return (
      !!first &&
      cards.some((c) => Math.abs(c.offsetLeft - first.offsetLeft) > 2)
    );
  }

  #hasOtherControls(card: PrismCard): boolean {
    return [...card.querySelectorAll(OTHER_CONTROLS)].some(
      (el) => !el.closest('prism-card-handle'),
    );
  }

  /** Handles, Move items and the drag-anywhere flag, kept in step with the cards. */
  #syncReorder(): void {
    const cards = this.#items;
    const grid = this.#isGrid(cards);
    cards.forEach((card, i) => {
      if (card.reorderable !== this.reorderable)
        card.reorderable = this.reorderable;
      card.toggleAttribute(
        'data-prism-grabbable',
        this.reorderable && !this.#hasOtherControls(card),
      );
      const handle = card.querySelector<PrismCardHandle>(
        ':scope > prism-card-handle',
      );
      const own = card.querySelector<HTMLElement>(
        ':scope > prism-card-actions > prism-menu',
      );
      const title = card.titleText;
      const specs = this.reorderable
        ? moveSpecs(grid, title, i, cards.length)
        : [];
      if (this.reorderable && !handle)
        devError(
          card,
          'A reorderable card needs a <prism-card-handle slot="header"> first in its header.',
        );
      if (own) {
        // The card's overflow menu carries the Move items; the handle is a
        // plain drag button. Never both.
        if (handle && handle.menu) handle.menu = false;
        if (handle) renderLight(handle, '', null);
        this.#syncMoveItems(own, specs);
      } else if (handle) {
        // No overflow menu: the handle is the menu button.
        if (handle.menu !== this.reorderable) handle.menu = this.reorderable;
        renderLight(
          handle,
          '',
          this.reorderable
            ? html`<prism-menu size="sm" label=${`Reorder ${title}`}>
                <span slot="trigger">${iconGrip()}</span>
                ${specs.map(
                  (s) =>
                    html`<prism-menu-item
                      data-prism-move=${s.dir}
                      aria-label=${s.name}
                      ?disabled=${s.disabled}
                      >${s.text}</prism-menu-item
                    >`,
                )}
              </prism-menu>`
            : null,
        );
      }
    });
  }

  /** Adds, updates or removes the Move items of an author's menu in place. */
  #syncMoveItems(menu: HTMLElement, specs: MoveSpec[]): void {
    const have = [
      ...menu.querySelectorAll<HTMLElement & { disabled: boolean }>(
        ':scope > prism-menu-item[data-prism-move]',
      ),
    ];
    specs.forEach((spec, k) => {
      let item = have[k];
      if (!item) {
        item = document.createElement('prism-menu-item');
        menu.append(item);
      }
      if (item.dataset['prismMove'] !== spec.dir)
        item.dataset['prismMove'] = spec.dir;
      if (item.textContent !== spec.text) item.textContent = spec.text;
      if (item.getAttribute('aria-label') !== spec.name)
        item.setAttribute('aria-label', spec.name);
      if (item.disabled !== spec.disabled) item.disabled = spec.disabled;
    });
    for (const extra of have.slice(specs.length)) extra.remove();
  }

  #setupDrag(): void {
    this.#drag?.detach();
    this.#drag = undefined;
    if (!this.reorderable) return;
    this.#drag = new ReorderDrag(this, {
      grab: (path) => this.#grab(path),
      targets: () => this.#dropTargets(),
      makeCopy: (item) => this.#makeCopy(item as PrismCard),
      indicator: (info) => this.#showLine(info),
      start: (item) => this.#onDragStart(item as PrismCard),
      drop: (item, to) => this.#onDrop(item as PrismCard, to),
    });
    this.#drag.attach();
  }

  /** From the handle, or from anywhere on a card with no other controls. */
  #grab(path: EventTarget[]): PrismCard | null {
    const card = path.find(
      (n): n is PrismCard =>
        n instanceof HTMLElement &&
        n.localName === 'prism-card' &&
        n.parentElement === this,
    );
    if (!card) return null;
    const handle = card.querySelector(':scope > prism-card-handle');
    if (handle && path.includes(handle)) return card;
    if (this.#hasOtherControls(card)) return null;
    // A press on a control of the card (it has none) or its text starts a drag.
    return card;
  }

  #dropTargets(): ReorderTarget[] {
    const lists = [this as PrismCardList];
    if (this.reorderGroup)
      for (const l of document.querySelectorAll<PrismCardList>(
        'prism-card-list[reorderable]',
      ))
        if (l !== this && l.reorderGroup === this.reorderGroup) lists.push(l);
    return lists.map((list) => ({ list, items: list.cardItems }));
  }

  /** The simplified copy: at most three pieces of information, about 280px. */
  #makeCopy(card: PrismCard): HTMLElement {
    const copy = document.createElement('div');
    copy.setAttribute('data-prism-drag-copy', '');
    copy.setAttribute('aria-hidden', 'true');
    const r = card.getBoundingClientRect();
    copy.style.width = `${String(Math.min(r.width, REORDER_COPY_MAX_PX))}px`;
    const pieces = [
      card.titleText,
      card.descriptionText,
      card
        .querySelector(':scope > prism-card-meta[slot="footer"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? '',
    ].filter(Boolean);
    pieces.forEach((text, i) => {
      const line = document.createElement('div');
      line.setAttribute(
        'data-prism-drag-copy-line',
        i === 0 ? 'title' : 'text',
      );
      line.textContent = text;
      copy.append(line);
    });
    return copy;
  }

  #showLine(info: DropIndicator | null): void {
    for (const l of document.querySelectorAll<PrismCardList>(
      'prism-card-list[reorderable]',
    ))
      l.#setLine(info && info.list === l ? info : null);
    this.#setLine(info && info.list === this ? info : null);
  }
  #setLine(info: DropIndicator | null): void {
    this.line = info;
  }

  #renderLine() {
    const info = this.line;
    if (!info) return html`<div part="drop-line" hidden></div>`;
    const host = this.getBoundingClientRect();
    const style = info.vertical
      ? `left:${String(info.x - host.left)}px;top:${String(info.y - host.top)}px;block-size:${String(info.length)}px`
      : `left:${String(info.x - host.left)}px;top:${String(info.y - host.top)}px;inline-size:${String(info.length)}px`;
    return html`<div
      part="drop-line"
      ?data-prism-vertical=${info.vertical}
      style=${style}
    >
      <span part="drop-dot"></span>
    </div>`;
  }

  #onDragStart(card: PrismCard): void {
    card.setAttribute('data-prism-dragging', '');
    // The dimmed original is a placeholder while its copy moves: inactive.
    card.inert = true;
    // Close any open menu or tooltip when the drag starts.
    for (const m of document.querySelectorAll<HTMLElement & { open: boolean }>(
      'prism-menu[open]',
    ))
      m.open = false;
    const i = this.#items.indexOf(card);
    this.announce(
      reorderMessages.pickedUp(card.titleText, this.#position(i), this.#count),
    );
  }

  #onDrop(card: PrismCard, to: DropPoint | null): void {
    card.removeAttribute('data-prism-dragging');
    card.inert = false;
    const target = to?.list as PrismCardList | undefined;
    if (!to || !target) {
      this.#announceStay(card);
      this.#focusHandle(card);
      return;
    }
    void this.#applyMove(card, target, to.index, 'handle');
  }

  #announceStay(card: PrismCard): void {
    const i = this.#items.indexOf(card);
    this.announce(
      reorderMessages.canceled(card.titleText, this.#position(i), this.#count),
    );
  }

  /** Visually hidden polite live region; clears first so a repeat is heard. */
  announce(text: string): void {
    this.message = '';
    void this.updateComplete.then(() => {
      this.message = text;
    });
  }

  /** Moves `card` so it ends at `index` among `target`'s other cards. */
  async #applyMove(
    card: PrismCard,
    target: PrismCardList,
    index: number,
    via: 'handle' | 'menu',
  ): Promise<void> {
    const source = (card.parentElement as PrismCardList | null) ?? this;
    const from = source.cardItems.indexOf(card);
    const fromPos = source.#position(from);
    if (target === source && index === from) {
      this.#announceStay(card);
      if (via === 'handle') this.#focusHandle(card);
      return;
    }
    const others = target.cardItems.filter((c) => c !== card);
    const before = others[index];
    if (before) before.before(card);
    else if (others.length)
      (others[others.length - 1] as PrismCard).after(card);
    else target.prepend(card);
    this.#history = undefined;
    target.#history = { card, source, index: from };
    await Promise.all([card.updateComplete, target.updateComplete]);
    target.#syncReorder();
    const now = target.cardItems.indexOf(card);
    const pos = target.#position(now);
    const total = target.#count;
    target.announce(
      target === source
        ? reorderMessages.moved(card.titleText, fromPos, pos, total)
        : reorderMessages.betweenLists(
            card.titleText,
            source.label || 'the list',
            target.label || 'the list',
            pos,
            total,
          ),
    );
    target.dispatchEvent(
      new CustomEvent('prism-card-reorder', {
        bubbles: true,
        composed: true,
        detail: {
          value: card.value,
          card,
          from: fromPos,
          to: pos,
          fromList: source,
          toList: target,
        },
      }),
    );
    target.#flash(card);
    if (via === 'handle') target.#focusHandle(card);
  }

  /**
   * Moves `card` into `target` (another list of the same `reorder-group`, or
   * this one) at `index` among the target's other cards, or to the end. Meant
   * for an app's own menu items such as "Move to row 2". It says what a drag
   * says (the card, both list labels and the new position), fires
   * `prism-card-reorder` and flashes the card. Focus goes back to the control
   * the person used, the card's menu button, so they can press it again.
   */
  async moveCardTo(
    card: PrismCard,
    target: PrismCardList,
    index?: number,
  ): Promise<void> {
    const at = index ?? target.cardItems.filter((c) => c !== card).length;
    await this.#applyMove(card, target, at, 'menu');
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const menu =
      card.querySelector<HTMLElement>(
        ':scope > prism-card-actions > prism-menu',
      ) ??
      card.querySelector<HTMLElement>(':scope > prism-card-handle prism-menu');
    menu?.shadowRoot?.querySelector<HTMLElement>('[part="trigger"]')?.focus();
  }

  /** Flash the moved card once, unless reduced motion is on. */
  #flash(card: PrismCard): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    card.removeAttribute('data-prism-flash');
    void card.offsetWidth;
    card.setAttribute('data-prism-flash', '');
    const clear = (): void => card.removeAttribute('data-prism-flash');
    card.addEventListener('animationend', clear, { once: true });
    setTimeout(clear, 1200);
  }

  /** Focus stays on the control that was used (the handle after a drag). */
  #focusHandle(card: PrismCard): void {
    const handle = card.querySelector<PrismCardHandle>(
      ':scope > prism-card-handle',
    );
    handle?.focusControl();
  }

  readonly #onMenuSelect = (event: Event): void => {
    const { item } = (event as CustomEvent<{ item: HTMLElement }>).detail;
    const dir = item.dataset['prismMove'] as MoveDir | undefined;
    if (!dir) return;
    const card = item.closest<PrismCard>('prism-card');
    if (!card || card.parentElement !== this) return;
    const menu = event.target as HTMLElement;
    const cards = this.#items;
    const i = cards.indexOf(card);
    const j =
      dir === 'top'
        ? 0
        : dir === 'bottom'
          ? cards.length - 1
          : dir === 'up'
            ? Math.max(0, i - 1)
            : Math.min(cards.length - 1, i + 1);
    void this.#applyMove(card, this, j, 'menu').then(() => {
      // After a move, focus returns to the control you used, so you can press
      // it again (the menu button of this card).
      requestAnimationFrame(() =>
        menu.shadowRoot
          ?.querySelector<HTMLElement>('[part="trigger"]')
          ?.focus(),
      );
    });
  };

  /**
   * Saving the new order failed: put the card back and say so. Show a Toast
   * from `prism-card-reorder-failed`. Undoes the latest move of this list.
   */
  rollback(): void {
    const h = this.#history;
    if (!h) return;
    this.#history = undefined;
    const { card, source, index } = h;
    const others = source.cardItems.filter((c) => c !== card);
    const before = others[index];
    if (before) before.before(card);
    else if (others.length)
      (others[others.length - 1] as PrismCard).after(card);
    else source.prepend(card);
    void card.updateComplete.then(() => {
      source.#syncReorder();
      const pos = source.#position(source.cardItems.indexOf(card));
      source.announce(
        reorderMessages.saveFailed(card.titleText, pos, source.#count),
      );
      source.dispatchEvent(
        new CustomEvent('prism-card-reorder-failed', {
          bubbles: true,
          composed: true,
          detail: { value: card.value, card },
        }),
      );
    });
  }

  override render() {
    const state = this.state;
    const whole =
      state === 'empty' || state === 'no-matches' || state === 'error';
    // An empty reorderable list is only a drop zone: a list with no items is
    // not a list for assistive tech.
    const listed =
      state !== 'loading' && !(this.reorderable && !this.#hasItems);
    return html`<div part="toolbar"><slot name="toolbar"></slot></div>
      <div
        part="busy"
        aria-hidden="true"
        ?hidden=${state !== 'refreshing'}
      ></div>
      ${
        whole
          ? html`<div part="state">
              <slot name="state"></slot><slot name="empty"></slot>
            </div>`
          : html`<div
              part="grid"
              role=${ifDefined(listed ? 'list' : undefined)}
              aria-label=${ifDefined(listed ? this.label || undefined : undefined)}
            >
              ${
                state === 'loading'
                  ? html`<slot name="skeleton"></slot>`
                  : html`<slot></slot>`
              }
            </div>`
      }
      <div part="pager"><slot name="pagination"></slot></div>
      ${this.#renderLine()}
      <div part="status" role="status" aria-live="polite">
        ${this.message}
      </div>`;
  }
}
