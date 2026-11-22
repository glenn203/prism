import { LitElement, css, html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { CARD_DEPTH, pressScale } from '../internal/press-scale.js';
import { stateLayer } from '../internal/state-layer.js';
import type { PrismCardTitle } from './card-title.js';
import type { PrismCardSelect } from './card-select.js';
import type { PrismCardHandle } from './card-handle.js';
import { renderLight } from './light-dom.js';
import {
  applyViolations,
  devError,
  validateFooter,
  validateHeader,
  type CardCapabilities,
} from './card-slots.js';

/** PROPOSED (page: "about 280px or less †"): the narrow breakpoint. */
export const CARD_NARROW_PX = 280;

export type CardType =
  | 'default'
  | 'borderless'
  | 'clickable'
  | 'selectable'
  | 'widget'
  | 'collapsible';
const CARD_TYPES: CardType[] = [
  'default',
  'borderless',
  'clickable',
  'selectable',
  'widget',
  'collapsible',
];
/** Page-level time range contract: set this on the Toolbar or the page. */
export const TIME_RANGE_ATTR = 'data-prism-time-range';
/** Collapsible cards nest at most two levels deep (card spec). */
export const COLLAPSIBLE_MAX_DEPTH = 2;

/**
 * One self-contained item with its own surface. NAMES PROVISIONAL except
 * Card, CardTitle and CardDescription (settled names).
 *
 * Three slots: `header`, `content` and `footer`. Header and footer accept only
 * the approved parts (see card-slots.ts); anything else is hidden with a dev
 * error. Unslotted children go to `content`, which is free.
 *
 * ```html
 * <prism-card>
 *   <prism-card-title slot="header" level="3">Onboarding guide</prism-card-title>
 *   <prism-card-description slot="header">Owner: Design</prism-card-description>
 *   <p>Free content.</p>
 *   <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
 *   <prism-card-actions slot="footer">
 *     <prism-button variant="ghost">View all</prism-button>
 *   </prism-card-actions>
 * </prism-card>
 * ```
 *
 * Accessibility: the card has no role of its own beyond `group` (standalone),
 * `listitem` (inside `prism-card-list`) or none (inside an `li`). Its name is
 * the CardTitle text, copied to `aria-label` because ID references cannot cross
 * shadow roots. It is never a landmark. An author `role` or `aria-label` wins.
 *
 * Types: `default`, `borderless`, `clickable`, `selectable` (`kind`),
 * `widget` and `collapsible`. Draggable cards come later.
 *
 * Widget (a Card in a Grid; there is no Widget component): the header holds
 * the title, a scope description and up to two actions (plus a compact
 * TimeRangeInput only when the widget overrides the page range). The time range
 * is set at page level: put `data-prism-time-range="Last 24 hours"` on the
 * Toolbar or page element; every widget below it follows it. A widget with its
 * own `range` overrides it, shows that range in its header and is marked
 * "Overridden" (text, not colour only). The card fires `prism-card-range` when
 * its effective range changes. `state="loading|error|empty"` replaces the
 * content only; header and footer stay. There is no resize here.
 *
 * Collapsible: the title row is the toggle button (`aria-expanded`, and
 * `aria-controls` pointing at the content), `open` is the state, and
 * `storage-key` remembers it for the session. Header actions sit beside the
 * toggle. Nest at most two levels.
 *
 * @tag prism-card
 * @slot header - CardTitle (required), CardDescription, icon or avatar, Tag or Badge, CardActions.
 * @slot content - Free content. Unslotted children land here too.
 * @slot footer - CardMeta at the start, CardActions at the end.
 * @csspart base - The card surface (padding, border, fill).
 * @csspart header - Header row.
 * @csspart content - Content area; grows so footers align across a row.
 * @csspart footer - Footer row.
 * @cssstate narrow - The card is 280px wide or less.
 * @cssstate has-header - The header slot has content.
 * @cssstate has-footer - The footer slot has content.
 * @cssstate collapsed - A collapsible card that is closed.
 * @cssstate range-overridden - A widget with its own time range.
 * @fires prism-card-open-change - A collapsible card opened or closed. `detail: { open }`.
 * @fires prism-card-range - A widget's effective time range changed. `detail: { range, overridden }`.
 * @fires prism-card-retry - Retry was pressed in the error state.
 * @fires prism-card-change-range - Change range was pressed in a widget's empty state.
 */
export class PrismCard extends LitElement {
  static override styles = [
    css`
      :host {
        /* PROPOSED (not in tokens/*.json): card padding is space-4 (16px) at
         default density, 12px compact, 20px comfortable. Built from the
         existing density pad units (compact 1, default 2, comfortable 3). */
        --_pad: calc(
          var(--prism-unit, 0.25rem) * (var(--prism-density-pad-units, 2) + 2)
        );
        display: block;
        position: relative;
        box-sizing: border-box;
        min-inline-size: 0;
      }
      :host([hidden]) {
        display: none;
      }
      [part='base'] {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        block-size: 100%;
        min-inline-size: 0;
        padding: var(--_pad);
      }
      [part='header'] {
        /* start items | title | tag | spacer | actions. The title column is
         max-content so a Tag sits right after the title text. */
        display: grid;
        grid-template-columns:
          auto auto auto minmax(0, max-content) auto minmax(0, 1fr)
          auto;
        align-items: start;
        margin-block-end: var(--prism-space-3, 0.75rem);
      }
      [part='header'][hidden],
      [part='footer'][hidden] {
        display: none;
      }
      [part='header'] ::slotted(prism-card-handle) {
        grid-column: 1;
        grid-row: 1;
        margin-inline-end: var(--prism-space-2, 0.5rem);
      }
      /* Centre the 32px handle on the title's first line. */
      [part='header'] ::slotted(prism-card-handle) {
        margin-block: calc(
          (var(--prism-font-line-height-20, 1.25rem) - 2rem) / 2
        );
      }
      [part='header'] ::slotted(prism-card-handle[menu]) {
        margin-block: calc(
          (
              var(--prism-font-line-height-20, 1.25rem) - var(
                  --prism-control-height-sm,
                  2rem
                )
            ) /
            2
        );
      }
      [part='header'] ::slotted(prism-card-select) {
        grid-column: 2;
        grid-row: 1;
        margin-inline-end: var(--prism-space-2, 0.5rem);
      }
      /* An avatar is taller than a line: it spans the title and description. */
      [part='header'] ::slotted(prism-avatar) {
        grid-column: 3;
        grid-row: 1 / span 2;
        align-self: start;
        margin-inline-end: var(--prism-space-2, 0.5rem);
      }
      [part='header'] ::slotted(prism-icon),
      [part='header'] ::slotted([data-prism-card-icon]) {
        grid-column: 3;
        grid-row: 1;
        margin-inline-end: var(--prism-space-2, 0.5rem);
        /* Centre a 16px icon on the title's first line. */
        margin-block-start: calc(
          (var(--prism-font-line-height-20, 1.25rem) - 1rem) / 2
        );
      }
      [part='header'] ::slotted(prism-card-title) {
        grid-column: 4;
        grid-row: 1;
      }
      [part='header'] ::slotted(prism-card-description) {
        grid-column: 4 / 7;
        grid-row: 2;
      }
      [part='header'] ::slotted(prism-tag),
      [part='header'] ::slotted(prism-badge) {
        grid-column: 5;
        grid-row: 1;
        margin-inline-start: var(--prism-space-2, 0.5rem);
      }
      [part='header'] ::slotted(prism-card-actions) {
        grid-column: 7;
        grid-row: 1 / span 2;
        margin-inline-start: var(--prism-space-2, 0.5rem);
        /* Centre a small icon button on the title's first line (20px). The
         button's hover fill may extend into the card padding, not over text. */
        margin-block: calc(
          (
              var(--prism-font-line-height-20, 1.25rem) - var(
                  --prism-control-height-sm,
                  2rem
                )
            ) /
            2
        );
      }
      /* Widget range line, under the description (row 3, title column). */
      [part='range'] {
        grid-column: 4 / 7;
        grid-row: 3;
        display: flex;
        flex-wrap: wrap;
        gap: var(--prism-space-2, 0.5rem);
        align-items: baseline;
        font-family: var(--prism-font-family-sans, system-ui, sans-serif);
        font-size: var(--prism-text-caption-font-size, 0.75rem);
        line-height: var(--prism-font-line-height-20, 1.25rem);
      }
      [part='range'][hidden] {
        display: none;
      }
      [part='content'][hidden] {
        display: none;
      }
      :host(:state(collapsed)) [part='header'] {
        margin-block-end: 0;
      }
      [part='status'] {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      /* States stay inside the card: only the content is replaced. */
      [part='content'] ::slotted([slot='state']) {
        display: contents;
      }
      [part='content'] {
        flex: 1 1 auto;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
      }
      [part='footer'] {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--prism-space-2, 0.5rem);
        margin-block-start: var(--prism-space-3, 0.75rem);
      }
      [part='footer'] ::slotted(prism-card-meta) {
        flex: 1 1 0;
        min-inline-size: 0;
      }
      [part='footer'] ::slotted(prism-card-actions) {
        margin-inline-start: auto;
      }
      /* A violation is never rendered (see card-slots.ts). */
      ::slotted([data-prism-invalid]) {
        display: none !important;
      }
      /* Narrow: everything stacks, actions stay at the end. */
      :host(:state(narrow)) [part='footer'] {
        flex-direction: column;
        align-items: stretch;
      }
      :host(:state(narrow)) [part='footer'] ::slotted(prism-card-actions) {
        align-self: flex-end;
      }

      /* ---- Interactive cards (clickable, choice, collection) ---- */
      /* Stretched link: the title's ::after covers the card (see card-title).
       Other controls sit above that layer and keep their own click areas. */
      ::slotted(
        :is(
          a,
          button,
          input,
          select,
          textarea,
          prism-button,
          prism-icon-button,
          prism-menu,
          prism-card-actions,
          prism-card-select,
          prism-card-handle
        )
      ) {
        position: relative;
        z-index: 1;
      }
      :host([type='clickable']) [part='base'],
      :host([type='selectable'][kind='choice']) [part='base'] {
        cursor: pointer;
      }
      :host(:state(disabled)) [part='base'] {
        cursor: default;
      }
      /* Only a clickable or choice card tints on hover or press. Every other
       card keeps the shared state layer for its selected look only (a selected
       card still goes 11% to 15% on hover, as the card spec says). */
      :host(:not([type='clickable'], [type='selectable'][kind='choice']))
        [part='base'] {
        --_prism-ov-hover: transparent;
        --_prism-ov-pressed: transparent;
      }
      /* Rule 3: no tint while the pointer is over a nested control. */
      [part='base'][data-prism-nested] {
        --_prism-state-overlay: transparent !important;
      }
      :host(:state(selected):not(:state(disabled)))
        [part='base'][data-prism-nested] {
        --_prism-state-overlay: var(--_prism-ov-selected) !important;
      }
    `,
    stateLayer("[part='base']"),
  ];

  /**
   * Surface type. `default` is bordered. `borderless` is a flat fill with no
   * border or shadow (replaces Panel); it is never clickable or selectable.
   * `clickable` makes the whole card one link or button through the stretched
   * title. `selectable` needs `kind`. Widget and collapsible arrive later.
   * Interactive types take the stronger edge so it meets 3:1. NAME PROVISIONAL.
   */
  @property({ reflect: true }) type: CardType = 'default';

  /** Collapsible only: open (content shown). Default closed. */
  @property({ type: Boolean, reflect: true }) open = false;

  /**
   * Collapsible only: remembers open or closed for the session under this key
   * (sessionStorage). A page may also put the state in the URL from the
   * `prism-card-open-change` event. NAME PROVISIONAL.
   */
  @property({ attribute: 'storage-key' }) storageKey?: string;

  /**
   * Widget (and any card in a list): `loading` shows a skeleton, `error` says
   * what failed with a Retry, `empty` says "No data for this range" and offers
   * "Change range" on a widget. Only the content is replaced. NAMES PROVISIONAL.
   */
  @property({ reflect: true }) state?: 'loading' | 'error' | 'empty';

  /** The reason for `state="error"` (what failed and why). */
  @property({ attribute: 'state-message' }) stateMessage = '';

  /** Widget only: this widget's own time range. Overrides the page's. */
  @property() range = '';

  /**
   * Selectable cards only. `choice` (plan picker, option grid) toggles when you
   * click anywhere on it and has no other controls. `collection` (a resource in a
   * list you bulk-act on) toggles only through its control, and its title stays
   * a link or button. NAMES PROVISIONAL.
   */
  @property({ reflect: true }) kind?: 'choice' | 'collection';

  /** The item's id, used for selection (kept across pages). */
  @property() value = '';

  /**
   * Selected. In a `prism-card-group` the group owns this; set the group's
   * `selected` instead. Initial `selected` attributes are read once.
   */
  @property({ type: Boolean, reflect: true }) selected = false;

  /**
   * Disabled clickable or selectable card. The reason must be written in the
   * CardDescription (not hidden in a tooltip); a dev error says so if missing.
   */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /**
   * Elevation treatment: a shadow from the predefined elevation level, plus a
   * transparent border (kept visible in forced-colors mode). Ignored on
   * borderless cards. NAME PROVISIONAL.
   */
  @property({ type: Boolean, reflect: true }) raised = false;

  /**
   * A standalone task card: its footer may hold one primary button. Without
   * it the footer takes ghost and secondary only. NAME PROVISIONAL.
   */
  @property({ type: Boolean, reflect: true }) standalone = false;

  /**
   * A reorderable card (set by `prism-card-list[reorderable]`): its header takes
   * a drag handle first. NAME PROVISIONAL (not `draggable`: that is a native
   * attribute with its own meaning).
   */
  @property({ type: Boolean, reflect: true }) reorderable = false;

  @state() private hasHeader = false;
  @state() private hasFooter = false;
  @state() private nested = false;

  /**
   * A clickable or choice card presses by about 1% (it is a big target). It
   * moves the `scale` property of the base, so the pointer tilt on the host
   * (a `transform`) stacks with it. Controls inside the card keep their own.
   */
  @state() private pageRange = '';

  readonly #internals = this.attachInternals();
  #observer?: MutationObserver;
  #resize?: ResizeObserver;
  #scheduled = false;

  get capabilities(): CardCapabilities {
    return {
      standalone: this.standalone,
      selectable: this.type === 'selectable',
      draggable: this.reorderable,
      widget: this.type === 'widget',
    };
  }

  get #title(): (PrismCardTitle & HTMLElement) | null {
    return this.querySelector(':scope > prism-card-title[slot="header"]');
  }
  get #select(): (PrismCardSelect & HTMLElement) | null {
    return this.querySelector(':scope > prism-card-select[slot="header"]');
  }
  /** The title text (the card's name). */
  get titleText(): string {
    return this.#title?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }
  /** The description text, if any. */
  get descriptionText(): string {
    return (
      this.querySelector(':scope > prism-card-description[slot="header"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  }

  /** The time range this widget shows: its own, else the page's. */
  get effectiveRange(): string {
    return this.range || this.pageRange;
  }
  /** True when the widget overrides the page range. */
  get rangeOverridden(): boolean {
    return this.type === 'widget' && !!this.range;
  }

  /** Nearest ancestor (also across shadow roots) with the page range. */
  #rangeSource(): Element | null {
    let node: Node | null =
      this.parentNode ?? (this.getRootNode() as ShadowRoot).host ?? null;
    while (node) {
      if (node instanceof Element && node.hasAttribute(TIME_RANGE_ATTR))
        return node;
      node = node.parentNode ?? (node as ShadowRoot).host ?? null;
    }
    return null;
  }
  #rangeObserver?: MutationObserver;
  #lastRange?: string;
  #syncPageRange = (): void => {
    const src = this.#rangeSource();
    this.pageRange = src?.getAttribute(TIME_RANGE_ATTR) ?? '';
  };
  #watchPageRange(): void {
    this.#rangeObserver?.disconnect();
    this.#rangeObserver = undefined;
    if (this.type !== 'widget') return;
    this.#syncPageRange();
    const src = this.#rangeSource();
    if (!src) return;
    this.#rangeObserver = new MutationObserver(this.#syncPageRange);
    this.#rangeObserver.observe(src, {
      attributes: true,
      attributeFilter: [TIME_RANGE_ATTR],
    });
  }

  /** Session memory for a collapsible card. */
  get #storeKey(): string | null {
    return this.storageKey ? `prism-card:${this.storageKey}` : null;
  }
  #restoreOpen(): void {
    const key = this.#storeKey;
    if (!key || this.type !== 'collapsible') return;
    try {
      const v = sessionStorage.getItem(key);
      if (v === '1') this.open = true;
      else if (v === '0') this.open = false;
    } catch {
      /* storage blocked: stay with the attribute */
    }
  }

  constructor() {
    super();
    pressScale(this, {
      target: () =>
        this.shadowRoot?.querySelector<HTMLElement>('[part="base"]'),
      depth: () => CARD_DEPTH,
      enabled: () =>
        !this.disabled &&
        (this.type === 'clickable' ||
          (this.type === 'selectable' && this.kind === 'choice')),
      accept: (e) =>
        e instanceof KeyboardEvent
          ? [this.#title, this.#select].some(
              (n) => n && e.composedPath().includes(n),
            )
          : !this.nested,
      rim: false,
      mark: true,
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#restoreOpen();
    this.#watchPageRange();
    this.#syncRole();
    this.#observer = new MutationObserver(() => this.#schedule());
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['slot', 'variant', 'level', 'href', 'action', 'label'],
    });
    this.#resize = new ResizeObserver(([entry]) => {
      const w = entry?.borderBoxSize?.[0]?.inlineSize ?? this.offsetWidth;
      this.#setState('narrow', w > 0 && w <= CARD_NARROW_PX);
    });
    this.#resize.observe(this);
    this.addEventListener('pointerover', this.#onPointerOver);
    this.addEventListener('pointerleave', this.#onPointerLeave);
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('focusout', this.#onFocusOut);
    this.addEventListener('click', this.#onClick);
    this.addEventListener('prism-card-toggle', this.#onToggle);
    this.addEventListener('prism-card-expand', this.#onExpand);
    this.#schedule();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#resize?.disconnect();
    this.#rangeObserver?.disconnect();
    this.removeEventListener('prism-card-expand', this.#onExpand);
    this.removeEventListener('pointerover', this.#onPointerOver);
    this.removeEventListener('pointerleave', this.#onPointerLeave);
    this.removeEventListener('focusin', this.#onFocusIn);
    this.removeEventListener('focusout', this.#onFocusOut);
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('prism-card-toggle', this.#onToggle);
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('type') || changed.has('raised')) {
      if (this.raised && this.type === 'borderless')
        devError(
          this,
          'A borderless card never has a shadow; `raised` is ignored.',
        );
      if (!CARD_TYPES.includes(this.type))
        devError(
          this,
          `Unknown type "${String(this.type)}". Available now: ${CARD_TYPES.join(', ')}.`,
        );
    }
    this.#setState('selected', this.selected && this.type === 'selectable');
    this.#setState('disabled', this.disabled);
    this.#setState('collapsed', this.type === 'collapsible' && !this.open);
    this.#setState('range-overridden', this.rangeOverridden);
    if (changed.has('type')) this.#watchPageRange();
    if (this.state)
      this.#setAttr('aria-busy', this.state === 'loading' ? 'true' : null);
    else this.#setAttr('aria-busy', null);
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (
      changed.has('standalone') ||
      changed.has('type') ||
      changed.has('kind') ||
      changed.has('disabled') ||
      changed.has('selected') ||
      changed.has('open') ||
      changed.has('reorderable')
    )
      this.#schedule();
    if (
      changed.has('state') ||
      changed.has('stateMessage') ||
      changed.has('type')
    )
      this.#renderState();
    if (changed.has('range') || changed.has('type'))
      // "Overridden" is a Tag, as light DOM so the theme styles it.
      renderLight(
        this,
        'range-flag',
        this.rangeOverridden
          ? html`<prism-tag size="sm" emphasis="low">Overridden</prism-tag>`
          : null,
      );
    if (
      changed.has('range') ||
      changed.has('pageRange') ||
      changed.has('type')
    ) {
      const range = this.effectiveRange;
      const key = `${range}|${String(this.rangeOverridden)}`;
      if (this.#lastRange !== undefined && this.#lastRange !== key)
        this.dispatchEvent(
          new CustomEvent('prism-card-range', {
            bubbles: true,
            composed: true,
            detail: { range, overridden: this.rangeOverridden },
          }),
        );
      this.#lastRange = key;
    }
    if (changed.has('open') && changed.get('open') !== undefined)
      this.#persistOpen();
  }

  #persistOpen(): void {
    const key = this.#storeKey;
    if (!key || this.type !== 'collapsible') return;
    try {
      sessionStorage.setItem(key, this.open ? '1' : '0');
    } catch {
      /* storage blocked */
    }
  }

  #onExpand = (event: Event): void => {
    if (this.type !== 'collapsible') return;
    // Only this card's own title; a nested collapsible handles itself.
    if (
      event.composedPath()[0] instanceof Element &&
      this.#title &&
      !event.composedPath().includes(this.#title)
    )
      return;
    event.stopPropagation();
    this.open = !this.open;
    this.dispatchEvent(
      new CustomEvent('prism-card-open-change', {
        bubbles: true,
        composed: true,
        detail: { open: this.open },
      }),
    );
  };

  /** What replaces the content in a card state, as light DOM so the theme
   *  reaches its buttons. Loading is announced from the status region. */
  #renderState(): void {
    let t: TemplateResult | null = null;
    if (this.state === 'loading')
      t = html`<prism-card-skeleton lines="3"></prism-card-skeleton>`;
    else if (this.state === 'error')
      t = html`<div data-prism-card-state="error">
        <p>${this.stateMessage || "This couldn't be loaded."}</p>
        <prism-button
          variant="secondary"
          size="sm"
          type="button"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent('prism-card-retry', {
                bubbles: true,
                composed: true,
              }),
            )}
          >Retry</prism-button
        >
      </div>`;
    else if (this.state === 'empty') {
      const widget = this.type === 'widget';
      t = html`<div data-prism-card-state="empty">
        <p>${widget ? 'No data for this range' : 'Nothing to show'}</p>
        ${
          widget
            ? html`<prism-button
                variant="ghost"
                size="sm"
                type="button"
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('prism-card-change-range', {
                      bubbles: true,
                      composed: true,
                    }),
                  )}
                >Change range</prism-button
              >`
            : null
        }
      </div>`;
    }
    renderLight(this, 'state', t);
  }

  get #statusText(): string {
    if (this.state === 'loading') return 'Loading';
    if (this.state === 'error')
      return this.stateMessage || "This couldn't be loaded.";
    if (this.state === 'empty')
      return this.type === 'widget'
        ? 'No data for this range'
        : 'Nothing to show';
    return '';
  }

  #setState(name: string, on: boolean): void {
    try {
      if (on) this.#internals.states.add(name);
      else this.#internals.states.delete(name);
    } catch {
      /* :state() unsupported */
    }
  }

  /** Slot children, flattened one level: direct children with slot=name. */
  #slotted(name: string): Element[] {
    return [...this.children].filter((c) => c.getAttribute('slot') === name);
  }

  #schedule = (): void => {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#validate();
    });
  };

  #validate(): void {
    const header = this.#slotted('header');
    const footer = this.#slotted('footer');
    this.hasHeader = header.length > 0;
    this.hasFooter = footer.length > 0;
    this.#setState('has-header', this.hasHeader);
    this.#setState('has-footer', this.hasFooter);
    const headerViolations = this.hasHeader
      ? validateHeader(header, this.capabilities, this)
      : [];
    applyViolations(header, headerViolations);
    applyViolations(footer, validateFooter(footer));
    // Actions groups re-check their own buttons against the card's flags.
    for (const el of [...header, ...footer])
      (el as Partial<{ revalidate(): void }>).revalidate?.();
    this.#syncName(header);
    this.#syncRole();
    this.#syncInteraction(header);
    this.#syncControlSizes();
  }

  /**
   * Every icon button and menu trigger in a card is small: 32px at the default
   * density, 24px compact and 40px comfortable, so it never drops under the 24px
   * minimum target (WCAG 2.5.8). Set here so authors can't drift.
   */
  #syncControlSizes(): void {
    for (const el of this.querySelectorAll('prism-icon-button, prism-menu'))
      if (el.getAttribute('size') !== 'sm') el.setAttribute('size', 'sm');
  }

  /** Wires the title, the selection control and the interaction rules. */
  #syncInteraction(header: Element[]): void {
    const title = this.#title;
    const select = this.#select;
    const clickable = this.type === 'clickable';
    const selectable = this.type === 'selectable';
    if (title) {
      // Stretch only on a clickable card. A collection card's title stays a
      // plain link or button; a borderless card is never interactive.
      title.stretch = clickable;
      title.flat = this.type === 'borderless';
      title.disabled = this.disabled;
      title.requestUpdate();
      if (
        clickable &&
        !title.hasAttribute('href') &&
        !title.hasAttribute('action')
      )
        devError(
          this,
          'A clickable card needs a link or button: give its CardTitle `href` (goes somewhere) or `action` (does something).',
        );
    }
    const handle = this.querySelector<PrismCardHandle>(
      ':scope > prism-card-handle[slot="header"]',
    );
    if (handle) {
      handle.label = this.titleText ? `Reorder ${this.titleText}` : 'Reorder';
      handle.hint = handle.menu
        ? ''
        : 'Drag to reorder. To move it with the keyboard, use the card menu.';
    }
    if (title) {
      const collapsible = this.type === 'collapsible';
      title.expandable = collapsible;
      title.expanded = collapsible && this.open;
      title.controls = collapsible
        ? [...this.children].filter(
            (c) =>
              (!c.hasAttribute('slot') ||
                c.getAttribute('slot') === 'content') &&
              !c.hasAttribute('data-prism-generated'),
          )
        : [];
      title.requestUpdate();
    }
    if (this.type === 'collapsible') {
      let depth = 1;
      for (
        let p = this.parentElement?.closest('prism-card[type="collapsible"]');
        p;
        p = p.parentElement?.closest('prism-card[type="collapsible"]')
      )
        depth++;
      if (depth > COLLAPSIBLE_MAX_DEPTH)
        devError(
          this,
          'Do not nest collapsible cards more than two levels. Use an Accordion for a set of foldable items.',
        );
    }
    if (this.type === 'widget') {
      if (
        !this.range &&
        this.querySelector(':scope > [slot="header"] prism-time-range-input')
      )
        devError(
          this,
          'A widget shows a TimeRangeInput only when it overrides the page range: set `range` too.',
        );
    }
    if (this.disabled && !this.descriptionText && (clickable || selectable))
      devError(
        this,
        'A disabled card says why in its text: add a CardDescription with the reason.',
      );
    if (selectable) {
      if (this.kind !== 'choice' && this.kind !== 'collection')
        devError(
          this,
          'A selectable card needs `kind="choice"` or `kind="collection"`.',
        );
      if (!select)
        devError(
          this,
          'A selectable card needs a visible prism-card-select in the header (never only on hover).',
        );
      if (
        this.kind === 'choice' &&
        this.querySelector(
          ':scope a[href], :scope button, :scope prism-button, :scope prism-icon-button, :scope prism-menu',
        )
      )
        devError(
          this,
          'A choice card toggles as a whole and has no other controls. Use a collection card for a card with actions.',
        );
    }
    if (select) {
      select.choice = this.kind === 'choice';
      select.checked = this.selected;
      select.disabled = this.disabled;
      select.syncText();
    }
    // Rule 6: a nested control's name says which card it belongs to.
    const name = this.titleText.toLowerCase();
    if (name)
      for (const c of this.querySelectorAll(
        ':scope > prism-card-actions > prism-icon-button, :scope > prism-card-actions > prism-menu',
      )) {
        const label = (c.getAttribute('label') ?? '').toLowerCase();
        if (label && !label.includes(name))
          devError(
            c,
            `A control inside a card names its card: label "${c.getAttribute('label') ?? ''}" should include "${this.titleText}" (for example "More options for ${this.titleText}").`,
          );
      }
    void header;
  }

  /** Rule 3: the tint shows on the card surface, not over a nested control. */
  #onPointerOver = (event: PointerEvent): void => {
    const path = event.composedPath();
    const title = this.#title;
    const select = this.#select;
    const choice = this.type === 'selectable' && this.kind === 'choice';
    // The title is the card's own action; a choice card's control is the card.
    if (
      (title && path.includes(title)) ||
      (choice && select && path.includes(select))
    ) {
      this.nested = false;
      return;
    }
    this.nested = path.some(
      (n) =>
        n instanceof Element &&
        n !== this &&
        n.matches(
          'a[href], button, input, select, textarea, prism-button, prism-icon-button, prism-menu, prism-card-select, [role="button"]',
        ),
    );
  };
  #onPointerLeave = (): void => {
    this.nested = false;
  };

  /** Rule 4: the title (or a choice card's control) rings the whole card. */
  #onFocusIn = (event: FocusEvent): void => {
    const target = event.composedPath()[0];
    if (!(target instanceof Element)) return;
    let visible = false;
    try {
      visible = target.matches(':focus-visible');
    } catch {
      visible = true;
    }
    const title = this.#title;
    const inTitle = !!title && event.composedPath().includes(title);
    const choiceControl =
      this.type === 'selectable' &&
      this.kind === 'choice' &&
      event.composedPath().includes(this.#select as EventTarget);
    this.#setState('focus-ring', visible && (inTitle || choiceControl));
  };
  #onFocusOut = (): void => this.#setState('focus-ring', false);

  /** A choice card toggles when you click anywhere on it. */
  #onClick = (event: MouseEvent): void => {
    if (
      this.type !== 'selectable' ||
      this.kind !== 'choice' ||
      this.disabled ||
      event.defaultPrevented
    )
      return;
    const select = this.#select;
    if (!select || event.composedPath().includes(select)) return; // the control handles itself
    select.dispatchEvent(
      new CustomEvent('prism-card-toggle', {
        bubbles: true,
        composed: true,
        detail: { checked: !this.selected },
      }),
    );
  };

  /** The control changed. Standalone cards flip; a group takes over. */
  #onToggle = (event: Event): void => {
    const detail = (event as CustomEvent<{ checked: boolean }>).detail;
    this.dispatchEvent(
      new CustomEvent('prism-card-change', {
        bubbles: true,
        composed: true,
        detail: { value: this.value, selected: detail.checked, card: this },
      }),
    );
    // Without a group nothing else will update us.
    if (!this.closest('prism-card-group, prism-card-list'))
      this.selected = detail.checked;
  };

  /** Role and name are set as host attributes (not only ElementInternals) so
   *  every assistive technology and test tool sees them, as prism-option does.
   *  An author-supplied `role` or `aria-label` always wins. */
  #own = new Set<string>();
  #setAttr(name: string, value: string | null): void {
    if (this.hasAttribute(name) && !this.#own.has(name)) return;
    if (value === null) {
      this.removeAttribute(name);
      this.#own.delete(name);
    } else {
      this.setAttribute(name, value);
      this.#own.add(name);
    }
  }

  #syncName(header: Element[]): void {
    const title = header.find((e) => e.localName === 'prism-card-title');
    const name = title?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    this.#setAttr('aria-label', name || null);
  }

  #syncRole(): void {
    const parent = this.parentElement;
    if (parent?.localName === 'li') this.#setAttr('role', null);
    else if (
      parent?.localName === 'prism-card-list' &&
      !this.hasAttribute('slot')
    )
      // A card in the list's `empty` slot sits outside the list wrapper.
      this.#setAttr('role', 'listitem');
    else this.#setAttr('role', 'group');
  }

  override render() {
    return html`<div part="base" ?data-prism-nested=${this.nested}>
      <div part="header" ?hidden=${!this.hasHeader}>
        <slot name="header"></slot>
        <div part="range" ?hidden=${!this.rangeOverridden}>
          <span part="range-text">${this.range}</span>
          <slot name="range-flag"></slot>
        </div>
      </div>
      <div part="content" ?hidden=${this.type === 'collapsible' && !this.open}>
        ${
          this.state
            ? html`<slot name="state"></slot>`
            : html`<slot name="content"></slot><slot></slot>`
        }
      </div>
      <div part="footer" ?hidden=${!this.hasFooter}>
        <slot name="footer"></slot>
      </div>
      ${
        this.type === 'widget' || this.state
          ? html`<div part="status" role="status" aria-live="polite">
              ${this.#statusText}
            </div>`
          : null
      }
    </div>`;
  }
}
