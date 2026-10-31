import { LitElement, css, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { textRole } from '../internal/control-styles.js';
import { pressDepth, pressScale } from '../internal/press-scale.js';
import { stateLayer } from '../internal/state-layer.js';

/**
 * One choice in a `prism-segmented-control`: `<prism-segment value="week">Week</prism-segment>`.
 * The control owns the selected value, the form value, the arrow keys and the
 * sliding indicator. A segment on its own selects nothing.
 *
 * - A native `<button role="radio" aria-checked>` in shadow DOM, named by its
 *   text. An icon-only segment needs `label`. Space picks it. Only the picked
 *   segment (or the first, if none is) is in the tab order.
 * - `checked` is set by the control from its `value`. Set the control's
 *   `value`, not this.
 * - Pressing scales the segment evenly (about 3%) and it eases back. Under
 *   `prefers-reduced-motion: reduce` only the press colour shows.
 * - State is never colour alone: the picked segment sits on the indicator,
 *   which is a filled shape.
 *
 * @tag prism-segment
 * @slot - The label.
 * @slot icon - An icon before the label.
 * @csspart base - The native button (scales while pressed).
 * @csspart icon - Wraps the icon slot.
 * @csspart label - Wraps the label.
 * @cssstate checked - This segment is picked.
 * @cssstate disabled - This segment is disabled.
 * @fires prism-segment-select - Bubbles when the user picks this segment; the control listens for it.
 */
export class PrismSegment extends LitElement {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles = [
    css`
      :host {
        display: flex;
        min-inline-size: 0;
      }
      :host([hidden]) {
        display: none;
      }
      [part='base'] {
        all: unset;
        box-sizing: border-box;
        position: relative;
        z-index: 1;
        display: inline-flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: var(--prism-space-2, 0.5rem);
        min-inline-size: 1.5rem;
        padding-inline: var(--prism-control-padding-inline, 0.75rem);
        border-radius: inherit;
        white-space: nowrap;
        cursor: var(--prism-button-cursor, pointer);
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        ${textRole('label')}
      }
      [part='base']:disabled {
        cursor: var(--prism-button-cursor-disabled, default);
      }
      /* The picked segment is painted by the control's indicator beneath it:
         the state layer adds nothing on top (!important beats its hover and
         pressed rules without repeating their selectors). */
      [part='base'][aria-checked='true'] {
        --_prism-state-overlay: transparent !important;
      }
      [part='icon'] {
        display: inline-flex;
        flex: none;
        inline-size: 1rem;
        block-size: 1rem;
      }
      [part='icon'] ::slotted(*) {
        inline-size: 100%;
        block-size: 100%;
      }
      [part='icon'][hidden] {
        display: none;
      }
    `,
    stateLayer("[part='base']"),
  ];

  /** Value the control takes when this segment is picked. */
  @property() value = '';

  /** The accessible name, for a segment with only an icon. Optional when there is text. */
  @property() label = '';

  /** Picked. Set by the control from its `value`. Reflected. */
  @property({ type: Boolean, reflect: true }) checked = false;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Set by the control: disabled by the control or a fieldset. */
  @property({ type: Boolean, attribute: false }) groupDisabled = false;

  /** Set by the control: whether this segment is the one in the tab order. */
  @property({ type: Boolean, attribute: false }) tabStop = true;

  @query('[part="base"]') private readonly base!: HTMLButtonElement;

  @state() private hasIcon = false;

  readonly #internals = this.attachInternals();

  get isDisabled(): boolean {
    return this.disabled || this.groupDisabled;
  }

  constructor() {
    super();
    pressScale(this, {
      target: () => this.base,
      depth: () => pressDepth('sm', 0),
      enabled: () => !this.isDisabled,
      mark: true,
    });
  }

  override focus(options?: FocusOptions): void {
    this.base?.focus(options);
  }

  /** Picks this segment as if the user had pressed it. */
  override click(): void {
    this.base?.click();
  }

  override willUpdate(): void {
    const states = this.#internals.states;
    for (const [name, on] of [
      ['checked', this.checked],
      ['selected', this.checked],
      ['disabled', this.isDisabled],
    ] as const)
      if (on) states.add(name);
      else states.delete(name);
  }

  override updated(): void {
    if (!this.label && !this.textContent?.trim())
      console.error(
        '[prism-segment] An icon-only segment needs `label`: it needs an accessible name.',
        this,
      );
  }

  readonly #pick = (): void => {
    if (this.isDisabled || this.checked) return;
    this.dispatchEvent(
      new Event('prism-segment-select', { bubbles: true, composed: true }),
    );
  };

  override render() {
    return html`<button
      part="base"
      type="button"
      role="radio"
      tabindex=${this.tabStop ? '0' : '-1'}
      aria-checked=${this.checked ? 'true' : 'false'}
      aria-label=${ifDefined(this.label || undefined)}
      ?disabled=${this.isDisabled}
      @click=${this.#pick}
    >
      <span part="icon" aria-hidden="true" ?hidden=${!this.hasIcon}
        ><slot
          name="icon"
          @slotchange=${(e: Event) =>
            (this.hasIcon =
              (e.target as HTMLSlotElement).assignedNodes().length > 0)}
        ></slot></span
      ><span part="label"><slot></slot></span>
    </button>`;
  }
}
