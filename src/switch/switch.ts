import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { FormAssociated } from '../internal/form-associated.js';
import { textRole } from '../internal/control-styles.js';
import { stateLayer } from '../internal/state-layer.js';
import { visuallyHidden } from '../internal/visually-hidden.js';
import { SwitchMotion } from '../internal/switch-motion.js';

/**
 * A switch: an on/off control that takes effect right away, like a light
 * switch. Use it for a setting ("Auto-refresh"), not for a choice that is only
 * saved when a form is submitted (use a checkbox there).
 *
 * - A native `<input type="checkbox" switch>` in shadow DOM, labelled only by
 *   a `<label for>`. Where the `switch` attribute is not supported, it stays
 *   a labelled checkbox (the accessible fallback). Space toggles it; it takes
 *   part in the tab order. The track keeps a 24px minimum target.
 * - Named by `label` (and any default-slot content). The label is visible by
 *   default; `hide-label` hides it from sight only.
 * - Joins the surrounding form: submits `value` (default "on") under `name`
 *   while on, and nothing while off. Resets to its starting state with the form.
 * - Fires `input` and `change` after each user toggle.
 * - Default look is still and readable: a flat track and pill thumb, the
 *   thumb at the start when off and at the end when on, the accent fill
 *   on or off at once. Stretch, glint, press-grow, springs and drag live in
 *   the polish layer and play only inside a polish motion scope
 *   (`data-prism-polish` with `motion`, `all`, or an empty attribute). Under
 *   `prefers-reduced-motion: reduce` the thumb jumps and the colour changes
 *   over 120ms.
 * - State is never colour alone: the thumb sits at the start when off and at
 *   the end when on.
 * - The hover, selected and pressed fills come from the shared state layer.
 *
 * @tag prism-switch
 * @slot - Extra label content, shown after `label`.
 * @csspart container - Wraps the control and its label.
 * @csspart base - The track. The native checkbox fills it for hits and focus.
 * @csspart wash - The accent fill that spreads across the track when on.
 * @csspart thumb - The sliding pill.
 * @csspart label - The visible label.
 * @cssstate checked - The switch is on.
 * @cssstate disabled - The switch is disabled.
 * @fires input - After the user toggles the switch.
 * @fires change - After the user toggles the switch.
 * @cssprop [--prism-switch-duration=400ms] - Time the move takes to settle (both directions). Defaults to `--prism-motion-switch`.
 */
export class PrismSwitch extends FormAssociated(LitElement) {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles = [
    visuallyHidden,
    css`
      :host {
        /* Track height, width and the gap around the thumb (default size md). */
        --_h: 1.75rem;
        --_w: 3.25rem;
        --_inset: 0.25rem;
        --_bd: var(--prism-border-width, 1px);
        --_dir: 1;
        /* Time the move takes to settle, on or off. */
        --_dur-on: var(
          --prism-switch-duration,
          var(--prism-motion-switch, 400ms)
        );
        display: inline-block;
        vertical-align: middle;
      }
      :host([size='sm']) {
        --_h: 1.5rem;
        --_w: 2.75rem;
        --_inset: 0.1875rem;
      }
      :host([size='lg']) {
        --_h: 2rem;
        --_w: 3.75rem;
      }
      :host(:dir(rtl)) {
        --_dir: -1;
      }
      :host([hidden]) {
        display: none;
      }
      /* The thumb is a pill, a quarter wider than it is tall. */
      [part='container'] {
        --_th: calc(var(--_h) - 2 * var(--_bd) - 2 * var(--_inset));
        --_tw: calc(var(--_th) * 1.25);
        --_inner: calc(var(--_w) - 2 * var(--_bd));
        --_travel: calc(var(--_inner) - 2 * var(--_inset) - var(--_tw));
        /* Thumb centre, measured from the left edge, off and on. */
        --_x-off: calc(
          var(--_inner) / 2 + var(--_dir) *
            (var(--_inset) + var(--_tw) / 2 - var(--_inner) / 2)
        );
        --_x-on: calc(var(--_x-off) + var(--_dir) * var(--_travel));
        display: flex;
        align-items: center;
        gap: var(--prism-space-3, 0.75rem);
      }
      /* Label before the switch. A block host pushes the switch to the
         far end of the row. */
      :host([label-position='start']) [part='container'] {
        flex-direction: row-reverse;
        justify-content: space-between;
      }
      [part='base'] {
        box-sizing: border-box;
        position: relative;
        flex: none;
        inline-size: var(--_w);
        block-size: var(--_h);
        min-inline-size: 1.5rem;
        min-block-size: 1.5rem;
        overflow: hidden;
        border-width: var(--_bd);
        border-style: solid;
        border-color: transparent;
        border-radius: var(--prism-radius-full, 9999px);
        cursor: var(--prism-switch-cursor, pointer);
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      :host(:state(disabled)) [part='base'] {
        cursor: var(--prism-switch-cursor-disabled, default);
      }
      /* The native control fills the track for hits and focus; the track
         itself is the styled base (an input cannot draw ::before or ::after). */
      [part='base'] > input {
        appearance: none;
        -webkit-appearance: none;
        position: absolute;
        inset: 0;
        z-index: 3;
        margin: 0;
        padding: 0;
        border: 0;
        inline-size: 100%;
        block-size: 100%;
        background: transparent;
        color: transparent;
        outline: none;
        cursor: inherit;
      }
      /* The accent fill: a circle as wide as the track, centred on the thumb.
         It grows from nothing as the thumb leaves and shrinks into it on the
         way back. Its scale and position are set by the same clock as the
         thumb. */
      [part='wash'] {
        position: absolute;
        inset-block-start: calc(50% - var(--_inner));
        left: 0;
        margin-left: calc(-1 * var(--_inner));
        inline-size: calc(2 * var(--_inner));
        block-size: calc(2 * var(--_inner));
        border-radius: 50%;
        pointer-events: none;
        transform: translateX(var(--_x-off)) scale(0);
      }
      :host(:state(checked)) [part='wash'] {
        transform: translateX(var(--_x-on)) scale(1);
      }
      /* The state layer's overlay, drawn above the wash and below the thumb. */
      [part='base']::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background-color: var(--_prism-state-overlay, transparent);
        pointer-events: none;
      }
      /* Hook for the polish glint: WAAPI targets this ::before from inside
         the shadow. The look (gradient, opacity, travel) lives in polish.css. */
      [part='base']::before {
        content: '';
        pointer-events: none;
      }
      [part='thumb'] {
        position: absolute;
        z-index: 2;
        inset-block-start: var(--_inset);
        inset-inline-start: var(--_inset);
        inline-size: var(--_tw);
        block-size: var(--_th);
        border-radius: var(--prism-radius-full, 9999px);
        /* The stretch holds the edge the thumb is leaving. */
        transform-origin: left center;
        transform: translateX(0);
      }
      :host(:dir(rtl)) [part='thumb'] {
        transform-origin: right center;
      }
      :host(:state(checked)) [part='thumb'] {
        transform: translateX(calc(var(--_dir) * var(--_travel)));
      }
      [part='label'] {
        ${textRole('body')}
        cursor: var(--prism-switch-cursor, pointer);
        user-select: none;
      }
      :host(:state(disabled)) [part='label'] {
        cursor: var(--prism-switch-cursor-disabled, default);
      }
      @media (prefers-reduced-motion: reduce) {
        /* No travel, stretch, press or drag motion: the thumb jumps and the
           track changes colour over 120ms. */
        [part='wash'] {
          inset: 0;
          margin: 0;
          inline-size: auto;
          block-size: auto;
          border-radius: inherit;
          transform: none;
          opacity: 0;
          transition: opacity 120ms linear;
        }
        :host(:state(checked)) [part='wash'] {
          transform: none;
          opacity: 1;
        }
        [part='thumb'] {
          transition: background-color 120ms linear;
        }
        [part='base']::before {
          display: none;
        }
      }
    `,
    stateLayer("[part='base']"),
    // After the state layer: its overlay moves to ::after so the wash sits
    // underneath it, and the fill is the track's own.
    css`
      [part='base'] {
        background-image: none;
      }
    `,
  ];

  /** On when set. Reflected. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** Value submitted with the form while on. */
  @property() value = 'on';

  /** Required. What the switch controls: "Auto-refresh". */
  @property() label = '';

  /** Hides the label from sight (it still names the switch). */
  @property({ type: Boolean, attribute: 'hide-label' }) hideLabel = false;

  /** Where the label sits: after the switch (`end`, default) or before it. */
  @property({ attribute: 'label-position', reflect: true }) labelPosition:
    'start' | 'end' = 'end';

  /** Size: sm, md or lg. */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';

  @query('[part="base"] > input') private readonly input!: HTMLInputElement;

  #defaultChecked?: boolean;
  readonly #motion = new SwitchMotion(this);

  override connectedCallback(): void {
    super.connectedCallback();
    // The first value seen is what a form reset goes back to.
    this.#defaultChecked ??= this.checked;
  }

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }

  /** Toggles the switch as if the user had pressed it. */
  override click(): void {
    this.input?.click();
  }

  formResetCallback(): void {
    this.checked = this.#defaultChecked ?? false;
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    this.checked = state === 'on';
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    this.setState('checked', this.checked);
    this.setState('selected', this.checked);
    if (changed.has('checked') || changed.has('value')) {
      this.internals.setFormValue(
        this.checked ? this.value : null,
        this.checked ? 'on' : 'off',
      );
    }
  }

  override updated(): void {
    if (!this.label && !this.textContent?.trim())
      console.error(
        '[prism-switch] `label` is required: a switch needs an accessible name.',
        this,
      );
    this.#motion.sync();
  }

  #onInput = (): void => {
    // The native `input` event is composed, so it already reaches the host.
    this.checked = this.input.checked;
  };

  #onChange = (): void => {
    // A native `change` stays inside the shadow root, so say it again on the host.
    this.dispatchEvent(new Event('change', { bubbles: true }));
  };

  override render() {
    return html`<div part="container">
      <span part="base">
        <input
          id="control"
          type="checkbox"
          switch
          .checked=${this.checked}
          ?disabled=${this.isDisabled}
          @input=${this.#onInput}
          @change=${this.#onChange}
        />
        <span part="wash" aria-hidden="true"></span>
        <span part="thumb" aria-hidden="true"></span>
      </span>
      <label
        part="label"
        for="control"
        class=${this.hideLabel ? 'visually-hidden' : ''}
        >${this.label}<slot></slot
      ></label>
    </div>`;
  }
}
