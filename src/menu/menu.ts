import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { iconMore } from '../internal/icons.js';
import { uniqueId } from '../internal/ids.js';
import {
  canAnchorPopup,
  clampPopupToViewport,
  positionPopup,
} from '../internal/popup-position.js';
import '../icon-button/define.js';
import { PrismMenuItem } from './menu-item.js';

const isItem = (el: Element): el is PrismMenuItem =>
  el instanceof PrismMenuItem;

/**
 * A menu button with a popup of actions (WAI-ARIA APG "Menu Button"). NAME
 * PROVISIONAL; a minimal stand-in until the full Menu
 * component. Used for a card's overflow menu and its Move menu.
 *
 * Keys on the button: Enter, Space and ArrowDown open on the first item;
 * ArrowUp opens on the last. In the menu: ArrowDown/ArrowUp (wrap), Home, End,
 * type-ahead, Enter/Space activate, Esc closes and returns focus to the
 * button, Tab closes. The popup is a native `popover="auto"` in the top
 * layer, so light dismiss is platform behaviour and no card or scroll
 * container clips it. It sits under the trigger (CSS anchor, with a JS
 * fallback) and flips above when there is no room below.
 *
 * @tag prism-menu
 * @slot - `prism-menu-item` children.
 * @slot trigger - Replaces the default "more" icon in the button.
 * @csspart trigger - The icon button that opens the menu.
 * @csspart trigger-base - The trigger's inner button element (re-exported from the icon button).
 * @csspart popup - The menu surface.
 * @cssstate open - The menu is open.
 * @fires prism-menu-select - An item was activated. `detail: { item, value, checked }`.
 */
export class PrismMenu extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
    }
    :host([hidden]) {
      display: none;
    }
    [part='popup'] {
      /* Top-layer popover. UA popover styles reset. */
      position: fixed;
      inset: auto;
      margin: 0;
      padding: var(--prism-space-1, 0.25rem);
      box-sizing: border-box;
      min-inline-size: 10rem;
      max-block-size: min(20rem, 100vh - 1rem);
      overflow: auto;
    }
    @supports (top: anchor(bottom)) {
      [part='trigger'] {
        anchor-name: --prism-menu-trigger;
      }
      [part='popup'] {
        position-anchor: --prism-menu-trigger;
        inset: unset;
        top: calc(anchor(bottom) + var(--prism-space-1, 0.25rem));
        right: anchor(right);
        left: auto;
        position-try-fallbacks: flip-block;
      }
      :host([align='start']) [part='popup'] {
        left: anchor(left);
        right: auto;
      }
    }
  `;

  /** Required. Names the button and the menu: "More options for {title}". */
  @property() label = '';
  /** Trigger size, passed to its icon button. NAME PROVISIONAL. */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Which edge of the button the popup aligns to. Follows direction. */
  @property({ reflect: true }) align: 'end' | 'start' = 'end';

  @query('[part="trigger"]') private readonly trigger!: HTMLElement;
  @query('[part="popup"]') private readonly popup!: HTMLElement;

  readonly #internals = this.attachInternals();
  readonly #id = uniqueId('prism-menu');
  #typeahead = '';
  #typeaheadTimer?: ReturnType<typeof setTimeout>;

  get items(): PrismMenuItem[] {
    return [...this.children].filter(isItem);
  }
  get #enabled(): PrismMenuItem[] {
    return this.items.filter((i) => !i.disabled);
  }

  /** True when we closed the popup ourselves, so a trigger click is not a dismiss. */
  #closing = false;
  /** Set when light dismiss closes the popup; the following trigger click is ignored. */
  #ignoreTriggerClick = false;

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open')) {
      try {
        if (this.open) this.#internals.states.add('open');
        else this.#internals.states.delete('open');
      } catch {
        /* :state() unsupported */
      }
    }
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!this.label && !this.hasAttribute('aria-label'))
      console.error(
        '[prism-menu] `label` is required: it names the menu button.',
        this,
      );
    if (!changed.has('open')) return;
    const shown = this.popup.matches(':popover-open');
    if (this.open && !shown) {
      this.popup.showPopover();
      this.#position();
    } else if (!this.open && shown) {
      this.popup.hidePopover();
    }
  }

  /** Opens and moves focus to the first (or last) enabled item. */
  async show(where: 'first' | 'last' = 'first'): Promise<void> {
    this.open = true;
    await this.updateComplete;
    const list = this.#enabled;
    (where === 'first' ? list[0] : list.at(-1))?.focus();
  }

  /** Closes. Focus returns to the button unless `restoreFocus` is false. */
  hide(restoreFocus = true): void {
    if (!this.open) return;
    this.#closing = true;
    this.open = false;
    if (restoreFocus) this.trigger?.focus();
  }

  #position(): void {
    if (canAnchorPopup()) {
      this.popup.style.left = '';
      this.popup.style.top = '';
      this.popup.style.right = '';
      clampPopupToViewport(this.popup);
      return;
    }
    positionPopup(this.popup, this.trigger, { align: this.align });
  }

  #onToggle = (event: ToggleEvent): void => {
    const next = event.newState === 'open';
    if (this.open !== next) this.open = next;
    if (next) {
      this.#position();
    } else if (this.#closing) {
      this.#closing = false;
    } else {
      // Light dismiss also fires a click on the trigger; don't reopen.
      this.#ignoreTriggerClick = true;
    }
  };

  #onTriggerClick = (): void => {
    if (this.#ignoreTriggerClick) {
      this.#ignoreTriggerClick = false;
      return;
    }
    if (this.open) this.hide();
    else void this.show('first');
  };

  #onTriggerKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      void this.show('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      void this.show('last');
    } else if (event.key === 'Escape' && this.open) {
      event.preventDefault();
      this.hide();
    }
  };

  #onPopupKeydown = (event: KeyboardEvent): void => {
    const list = this.#enabled;
    const current = list.indexOf(
      (event.target as Element).closest('prism-menu-item') as PrismMenuItem,
    );
    const go = (i: number) => {
      event.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        return go(current + 1);
      case 'ArrowUp':
        return go(current < 0 ? -1 : current - 1);
      case 'Home':
        return go(0);
      case 'End':
        return go(-1);
      case 'Escape':
        event.preventDefault();
        return this.hide();
      case 'Tab':
        // Native Tab moves on; the menu closes without stealing focus back.
        return this.hide(false);
      case ' ':
        if (this.#typeahead) {
          // Mid type-ahead: a space is part of the search, not an activation.
          event.preventDefault();
          return this.#typeaheadTo(' ', list, current);
        }
        event.preventDefault();
        return list[current]?.click();
      case 'Enter':
        event.preventDefault();
        return list[current]?.click();
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.#typeaheadTo(event.key.toLowerCase(), list, current);
        }
    }
  };

  #typeaheadTo(char: string, list: PrismMenuItem[], current: number): void {
    clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = setTimeout(() => (this.#typeahead = ''), 500);
    const same =
      this.#typeahead.length > 0 &&
      [...this.#typeahead].every((c) => c === char);
    this.#typeahead += char;
    const query = same ? char : this.#typeahead;
    const ordered = [...list.slice(current + 1), ...list.slice(0, current + 1)];
    ordered
      .find((i) => (i.textContent ?? '').trim().toLowerCase().startsWith(query))
      ?.focus();
  }

  #onPopupClick = (event: Event): void => {
    const item = (event.target as Element).closest('prism-menu-item');
    if (!item || !isItem(item) || item.disabled) return;
    this.dispatchEvent(
      new CustomEvent('prism-menu-select', {
        bubbles: true,
        composed: true,
        detail: { item, value: item.resolvedValue, checked: item.checked },
      }),
    );
    // A checkbox item stays open, so the tick is seen drawing.
    if (!item.checkable) this.hide();
  };

  #onFocusout = (event: FocusEvent): void => {
    const to = event.relatedTarget as Node | null;
    if (this.open && to && !this.contains(to) && !this.shadowRoot?.contains(to))
      this.hide(false);
  };

  override render() {
    return html`<prism-icon-button
        part="trigger"
        exportparts="base:trigger-base"
        .label=${this.label}
        size=${this.size}
        haspopup="menu"
        .expanded=${this.open}
        @click=${this.#onTriggerClick}
        @keydown=${this.#onTriggerKeydown}
        @focusout=${this.#onFocusout}
      >
        <slot name="trigger">${iconMore()}</slot>
      </prism-icon-button>
      <div
        part="popup"
        id=${this.#id}
        role="menu"
        popover="auto"
        aria-label=${this.label}
        @toggle=${this.#onToggle}
        @keydown=${this.#onPopupKeydown}
        @click=${this.#onPopupClick}
        @focusout=${this.#onFocusout}
      >
        <slot></slot>
      </div>`;
  }
}
