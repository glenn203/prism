import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { iconChevronDown, iconX } from '../internal/icons.js';
import { tonePalette } from '../internal/tones.js';
import { pressDepth, pressScale } from '../internal/press-scale.js';
import { stateLayer } from '../internal/state-layer.js';

export type TagTone =
  'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
export type TagJob =
  | 'spectrum'
  | 'status'
  | 'presence'
  | 'clarity'
  | 'illusionary'
  | 'health'
  | 'refractive-rules'
  | 'diffusion'
  | 'keyword';

/**
 * A short label on an item: a category, a keyword or a property, so people can
 * find and tell things apart. Names and values follow the Tag page: `job`,
 * `emphasis` and `tone`. `size` is NAME PROVISIONAL.
 *
 * Four behaviors, split by what a person can do (not by colour):
 * - read-only (default): a label, no click.
 * - `dismissible`: a remove button ("Remove {text}"); fires `prism-tag-remove`.
 *   The tag does not remove itself: the app decides.
 * - `selectable`: a toggle button (`aria-pressed`); fires `prism-tag-select`.
 * - `trigger`: a button that opens something (a Select) and shows a caret in
 *   the trailing slot; fires `prism-tag-trigger`. It looks like any other Tag.
 *
 * A Tag never navigates. For a link use a link. For a count or Live / Running
 * / Stopped use Badge.
 *
 * Accessibility: the text is the name and the meaning, so colour is never the
 * only signal. Put a short word in the tag (a few words, no wrapping). An
 * icon only helps reading. Interactive tags are at least 24px high even at
 * `size="sm"` (WCAG 2.5.8).
 *
 * @tag prism-tag
 * @slot - The text. Required, short.
 * @slot icon - Optional icon in front. Decorative.
 * @slot trailing - Optional, after the text. A caret by default on a `trigger`.
 * @csspart base - The tag box (a span, or a button when interactive).
 * @csspart label - The text.
 * @csspart remove - The remove button of a dismissible tag.
 * @fires prism-tag-remove - The remove button was pressed.
 * @fires prism-tag-select - A selectable tag toggled. `detail: { selected }`.
 * @fires prism-tag-trigger - A trigger tag was pressed.
 * @cssstate selected - A selectable tag that is on.
 * @cssstate interactive - A selectable or trigger tag.
 * @cssstate disabled - A disabled interactive tag.
 */
export class PrismTag extends LitElement {
  static override styles = [
    tonePalette('tone'),
    css`
      :host {
        /* PROPOSED tag text: 12/16, weight 500, built from existing primitives. */
        --_tag-font-size: var(--prism-text-supporting-font-size, 0.75rem);
        --_tag-line-height: var(--prism-font-line-height-16, 1rem);
        --_tag-font-weight: var(--prism-font-weight-medium, 500);
        --_tag-height: 1.5rem;
        display: inline-flex;
        max-inline-size: 100%;
        vertical-align: middle;
      }
      :host([size='sm']) {
        --_tag-height: 1.25rem;
      }
      :host([hidden]) {
        display: none;
      }
      [part='base'] {
        all: unset;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: var(--prism-space-1, 0.25rem);
        min-block-size: var(--_tag-height);
        max-inline-size: 100%;
        padding-inline: var(--prism-space-2, 0.5rem);
        border: var(--prism-border-width, 1px) solid transparent;
        border-radius: var(--prism-radius-3, 3px);
        font-family: var(--prism-font-family-sans, Inter, sans-serif);
        font-size: var(--_tag-font-size);
        line-height: var(--_tag-line-height);
        font-weight: var(--_tag-font-weight);
        white-space: nowrap;
      }
      [part='label'] {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      button[part='base'] {
        cursor: var(--prism-button-cursor, pointer);
      }
      button[part='base']:disabled {
        cursor: var(--prism-button-cursor-disabled, default);
      }
      /* Targets are never smaller than 24px, even at size sm. */
      :host(:state(interactive)) [part='base'],
      [part='remove'] {
        min-block-size: 1.5rem;
      }
      button[part='base']:focus-visible,
      [part='remove']:focus-visible {
        outline: revert;
      }
      ::slotted([slot='icon']),
      slot[name='icon']::slotted(*) {
        flex: none;
        inline-size: 1rem;
        block-size: 1rem;
      }
      [part='remove'] {
        all: unset;
        box-sizing: border-box;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 1.5rem;
        block-size: 1.5rem;
        margin-inline-end: calc(var(--prism-space-2, 0.5rem) * -1);
        border-radius: var(--prism-radius-3, 3px);
        cursor: var(--prism-button-cursor, pointer);
      }
      [part='remove'] svg {
        inline-size: 0.75rem;
        block-size: 0.75rem;
      }
    `,
    stateLayer("button[part='base']"),
    stateLayer("[part='remove']"),
  ];

  /** The Tag's meaning. Only a label for scripts and analytics. */
  @property({ reflect: true }) job?: TagJob;
  /** How loud the fill is. `low` (light tint) is the default. */
  @property({ reflect: true }) emphasis: 'high' | 'low' | 'ghost' = 'low';
  /** The colour family. The text carries the meaning, not the colour. */
  @property({ reflect: true }) tone: TagTone = 'neutral';
  /** `sm` is 20px, `md` 24px. NAME PROVISIONAL. */
  @property({ reflect: true }) size: 'sm' | 'md' = 'md';
  /** Adds a remove button. */
  @property({ type: Boolean, reflect: true }) dismissible = false;
  /** Makes the tag an on/off toggle. */
  @property({ type: Boolean, reflect: true }) selectable = false;
  /** Whether a selectable tag is on. */
  @property({ type: Boolean, reflect: true }) selected = false;
  /** Makes the tag a button that opens a Select (or similar). */
  @property({ type: Boolean, reflect: true }) trigger = false;
  /** Trigger: whether what it opens is open. */
  @property({ type: Boolean }) expanded = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Label for the remove button's name, after "Remove". Defaults to the text. */
  @property({ attribute: 'remove-label' }) removeLabel = '';

  @state() private text = '';
  readonly #internals = this.attachInternals();

  constructor() {
    super();
    pressScale(this, {
      target: () =>
        this.shadowRoot?.querySelector<HTMLElement>('button[part="base"]'),
      depth: () => pressDepth('sm', 0),
      enabled: () => !this.disabled,
      mark: true,
    });
    pressScale(this, {
      target: () =>
        this.shadowRoot?.querySelector<HTMLElement>('[part="remove"]'),
      depth: () => pressDepth('sm', 0),
      mark: true,
    });
  }

  override willUpdate(): void {
    const interactive = this.selectable || this.trigger;
    this.#state('interactive', interactive);
    this.#state('selected', this.selectable && this.selected);
    this.#state('disabled', interactive && this.disabled);
  }

  override firstUpdated(): void {
    const slot =
      this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    if (slot) this.#readText(slot);
  }

  override updated(): void {
    if (this.selectable && this.trigger)
      console.error(
        '[prism-tag] `selectable` and `trigger` are different behaviors; use one.',
        this,
      );
  }

  #state(name: string, on: boolean): void {
    try {
      if (on) this.#internals.states.add(name);
      else this.#internals.states.delete(name);
    } catch {
      /* :state() unsupported */
    }
  }

  #readText(slot: HTMLSlotElement): void {
    this.text = slot
      .assignedNodes({ flatten: true })
      .map((n) => n.textContent ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!this.text)
      console.error(
        '[prism-tag] A tag needs text: colour and icons are never enough.',
        this,
      );
  }

  #onSlot = (event: Event): void => {
    this.#readText(event.target as HTMLSlotElement);
  };

  #fire(name: string, detail?: unknown): void {
    this.dispatchEvent(
      new CustomEvent(name, { bubbles: true, composed: true, detail }),
    );
  }

  #onSelect = (): void => {
    if (this.disabled) return;
    this.selected = !this.selected;
    this.#fire('prism-tag-select', { selected: this.selected });
  };

  override focus(options?: FocusOptions): void {
    this.shadowRoot?.querySelector<HTMLElement>('button')?.focus(options);
  }

  override render() {
    const content = html`<slot name="icon"></slot
      ><span part="label"><slot @slotchange=${this.#onSlot}></slot></span>`;
    if (this.selectable)
      return html`<button
        part="base"
        type="button"
        aria-pressed=${this.selected ? 'true' : 'false'}
        ?disabled=${this.disabled}
        @click=${this.#onSelect}
      >
        ${content}<slot name="trailing"></slot>
      </button>`;
    if (this.trigger)
      return html`<button
        part="base"
        type="button"
        aria-haspopup="listbox"
        aria-expanded=${this.expanded ? 'true' : 'false'}
        ?disabled=${this.disabled}
        @click=${() => !this.disabled && this.#fire('prism-tag-trigger')}
      >
        ${content}<slot name="trailing">${iconChevronDown()}</slot>
      </button>`;
    return html`<span part="base"
      >${content}<slot name="trailing"></slot>${
        this.dismissible
          ? html`<button
              part="remove"
              type="button"
              aria-label=${`Remove ${this.removeLabel || this.text}`.trim()}
              @click=${() => this.#fire('prism-tag-remove')}
            >
              ${iconX()}
            </button>`
          : nothing
      }</span
    >`;
  }
}
