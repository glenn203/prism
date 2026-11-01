import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { canAnimate } from '../internal/choice-motion.js';
import { controlSize, textRole } from '../internal/control-styles.js';
import {
  fieldPartsStyles,
  renderDescription,
  renderError,
  syncFieldA11y,
} from '../internal/field-parts.js';
import { FieldValidityController } from '../internal/field-validity.js';
import { FormAssociated } from '../internal/form-associated.js';
import { uniqueId } from '../internal/ids.js';
import { PressScale, pressDepth } from '../internal/press-scale.js';
import { stateLayer } from '../internal/state-layer.js';
import { SpringMotion, type Tune } from '../internal/spring-motion.js';
import { visuallyHidden } from '../internal/visually-hidden.js';
import {
  FADE,
  LEAD,
  REF,
  TRAIL,
  indicatorLook,
  type Bounds,
  type IndicatorPose,
} from './indicator-motion.js';
import type { PrismSegment } from './segment.js';

/**
 * A row of mutually exclusive choices that share one sliding indicator, like a
 * set of radio buttons drawn as a switch between views: `<prism-segmented-control
 * label="Range"><prism-segment value="day">Day</prism-segment>…`.
 *
 * - A native `<fieldset>` with a `<legend>` carrying `label` (`hide-label`
 *   keeps it for screen readers only). Put help text in the `description` slot
 *   and the message for a failed check in the `error` slot.
 * - Each child `prism-segment` is drawn as a native `<input type="radio">` inside
 *   a real `<label>`, all in this one shadow root so they share a name. Tab
 *   stop, arrow keys (all four, skipping disabled segments) and Space are the
 *   browser's, with no key handling here. Chrome and Firefox also wrap round at
 *   the ends and flip Left and Right in right-to-left text; WebKit does
 *   neither, as for any native radios.
 * - `value` is the picked segment's `value` (empty: none, and no indicator).
 *   It is what is submitted under `name`. `required` fails validation while
 *   none is picked. A segment with `checked` in the markup sets the starting
 *   value. Resets to the starting value with the form.
 * - Fires `input` and `change` after each user pick.
 * - Disabling the control disables every segment in it.
 * - Pressing scales the segment evenly (about 3%) and it eases back. Under
 *   `prefers-reduced-motion: reduce` only the press colour shows.
 * - Each segment's parts also carry `checked` and `disabled` while they apply,
 *   so a theme can target `::part(segment checked)`.
 * - Sizes `sm`, `md`, `lg` follow the control heights and density. `full-width`
 *   shares the row equally.
 * - Motion: the indicator slides to the picked segment on two springs (one per
 *   edge) so it stretches on the way, about 300ms, with a small overshoot that
 *   never leaves the track. A new pick during the move turns it round from where
 *   it is. Transform and opacity only. Nothing moves on first paint, on a
 *   resize, or when the width of a segment changes: the indicator just follows.
 *   A change from code moves the same way as a click. Under
 *   `prefers-reduced-motion: reduce` it jumps and the colours change at once.
 *
 * @tag prism-segmented-control
 * @slot - The `prism-segment` choices.
 * @slot description - Help text under the label.
 * @slot error - Message shown while the control is invalid.
 * @csspart group - The fieldset.
 * @csspart label - The control's legend.
 * @csspart description - The help text.
 * @csspart track - The rounded row that holds the segments.
 * @csspart indicator - The sliding shape under the picked segment.
 * @csspart segment - One segment's label: it holds the input and the segment, and scales while pressed.
 * @csspart base - A segment's native radio input, laid over it; it carries the focus ring.
 * @csspart error - The error message.
 * @cssstate disabled - The control is disabled.
 * @cssstate invalid - Fails validation (after interaction or submit).
 * @fires input - After the user picks a segment.
 * @fires change - After the user picks a segment.
 */
export class PrismSegmentedControl extends FormAssociated(LitElement) {
  static override styles = [
    visuallyHidden,
    fieldPartsStyles,
    controlSize,
    css`
      :host {
        --_pad: var(--prism-segmented-padding, 2px);
      }
      [part='group'] {
        display: grid;
        justify-items: start;
        row-gap: var(--prism-space-1, 0.25rem);
        min-inline-size: 0;
        margin: 0;
        padding: 0;
        border: 0;
      }
      [part='label'] {
        padding: 0;
      }
      :host([full-width]) [part='group'] {
        justify-items: stretch;
      }
      [part='track'] {
        position: relative;
        box-sizing: border-box;
        display: inline-flex;
        align-items: stretch;
        block-size: var(--_prism-control-height);
        padding: var(--_pad);
        border: var(--prism-border-width, 1px) solid transparent;
        border-radius: var(--prism-radius-5, 5px);
        max-inline-size: 100%;
      }
      :host([full-width]) [part='track'] {
        display: flex;
      }
      :host([full-width]) [part~='segment'] {
        flex: 1 1 0;
      }
      [part='indicator'] {
        position: absolute;
        inset-block: var(--_pad);
        left: 0;
        inline-size: ${REF}px;
        transform-origin: 0 50%;
        border-radius: var(--prism-radius-3, 3px);
        pointer-events: none;
        z-index: 0;
      }
      [part~='segment'] {
        box-sizing: border-box;
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 1.5rem;
        padding-inline: var(--prism-control-padding-inline, 0.75rem);
        border-radius: var(--prism-radius-3, 3px);
        white-space: nowrap;
        cursor: var(--prism-button-cursor, pointer);
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        ${textRole('label')}
      }
      [part~='segment'][part~='disabled'] {
        cursor: var(--prism-button-cursor-disabled, default);
      }
      /* The input fills the segment and is invisible; its outline is the focus ring. */
      [part~='base'] {
        all: unset;
        position: absolute;
        inset: 0;
        border-radius: inherit;
        cursor: inherit;
        outline: 2px solid transparent;
        outline-offset: -3px;
      }
    `,
    stateLayer("[part~='segment']"),
    css`
      /* The picked segment is painted by the indicator beneath it: the state
         layer adds nothing on top. Its overlays are all empty, so every state
         rule resolves to nothing. */
      [part~='segment']:has(> :checked) {
        --_prism-ov-hover: transparent;
        --_prism-ov-pressed: transparent;
        --_prism-ov-selected: transparent;
        --_prism-ov-selected-hover: transparent;
      }
    `,
  ];

  /** The picked segment's `value`; empty when none is picked. */
  @property({ reflect: true }) value = '';

  /** Required. What the choice is: "Range". */
  @property() label = '';

  /** Keeps the label for screen readers only. */
  @property({ type: Boolean, attribute: 'hide-label' }) hideLabel = false;

  /** A pick is required for the form to submit. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Control height: sm, md or lg. Follows density. */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';

  /** Share the row equally and fill the width. */
  @property({ type: Boolean, reflect: true, attribute: 'full-width' })
  fullWidth = false;

  @query('[part="group"]') private readonly group!: HTMLFieldSetElement;
  @query('[part="track"]') private readonly track!: HTMLElement;
  @query('[part="indicator"]') private readonly indicator!: HTMLElement;

  readonly #id = uniqueId('prism-segmented-control');
  readonly #validity = new FieldValidityController(this);
  readonly #motion = new SpringMotion<'l' | 'r' | 'o', 'ind'>(
    ['l', 'r', 'o'],
    { ind: { el: () => this.indicator } },
    (pose) => ({ ind: indicatorLook(pose, this.#bounds) }),
  );
  readonly #sizes = new ResizeObserver(() => this.#follow());
  readonly #presses = new Map<PrismSegment, PressScale>();
  /** What each segment's `slot` attribute was before the control took it over. */
  readonly #authorSlots = new Map<PrismSegment, string | null>();
  #segments: PrismSegment[] = [];
  #bounds: Bounds = { min: 0, max: 0 };
  #defaultValue = '';
  #adopted = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('prism-segment-change', this.#redraw);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('prism-segment-change', this.#redraw);
    this.#sizes.disconnect();
    this.#motion.stop();
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    this.#validity.touch();
    return this.internals.reportValidity();
  }

  formResetCallback(): void {
    this.value = this.#defaultValue;
    this.#validity.reset();
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    this.value = typeof state === 'string' ? state : '';
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    this.#readSegments();
    if (changed.has('value'))
      this.internals.setFormValue(this.value || null, this.value);
  }

  override firstUpdated(): void {
    this.#sizes.observe(this.track);
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!this.label)
      console.error(
        '[prism-segmented-control] `label` is required: a group needs an accessible name.',
        this,
      );
    this.internals.setValidity(
      this.required && !this.value ? { valueMissing: true } : {},
      'Pick one of these choices to continue.',
      this.#segments[0]?.input ?? this.group,
    );
    syncFieldA11y(this.renderRoot, this.group, this.#id, this.#validity.sync());
    for (const segment of this.#segments) {
      const label = this.#labelOf(segment);
      if (label) this.#sizes.observe(label);
    }
    if (changed.has('value') && changed.get('value') !== undefined)
      this.#slide();
  }

  /**
   * Reads the child segments: gives each a slot of its own (the control puts
   * it inside that segment's `<label>`), pushes the picked state into it, gives
   * it a press, and sets the starting value from a segment marked `checked` in
   * the markup, once.
   */
  #readSegments(): void {
    this.#segments = [
      ...this.querySelectorAll<PrismSegment>(':scope > prism-segment'),
    ];
    if (!this.#adopted && this.#segments.length) {
      this.#adopted = true;
      if (!this.value)
        this.value = this.#segments.find((s) => s.checked)?.value ?? '';
      this.#defaultValue = this.value;
    }
    for (const segment of this.#segments) {
      segment.checked = this.#isPicked(segment);
      if (!this.#presses.has(segment)) this.#addSegment(segment);
    }
    for (const [segment, press] of this.#presses)
      if (!this.#segments.includes(segment)) {
        this.removeController(press);
        press.hostDisconnected();
        this.#presses.delete(segment);
        this.#releaseSlot(segment);
      }
  }

  #addSegment(segment: PrismSegment): void {
    this.#authorSlots.set(segment, segment.getAttribute('slot'));
    segment.slot = uniqueId('prism-segment');
    this.#presses.set(
      segment,
      new PressScale(this, {
        target: () => this.#labelOf(segment),
        depth: () => pressDepth('sm', 0),
        enabled: () => !this.#isOff(segment),
        enter: false,
        rim: false,
        mark: true,
      }),
    );
  }

  /** A segment that leaves the control gets its own `slot` back. */
  #releaseSlot(segment: PrismSegment): void {
    const own = this.#authorSlots.get(segment);
    if (own === null || own === undefined) segment.removeAttribute('slot');
    else segment.setAttribute('slot', own);
    this.#authorSlots.delete(segment);
  }

  /** The segment's `<label>` in this shadow root: the parent of the slot it fills. */
  #labelOf(segment: PrismSegment): HTMLElement | null {
    return segment.assignedSlot?.parentElement ?? null;
  }

  #isPicked(segment: PrismSegment): boolean {
    return this.value !== '' && segment.value === this.value;
  }

  #isOff(segment: PrismSegment): boolean {
    return segment.disabled || this.isDisabled;
  }

  /** A segment was added, removed or changed: draw again. */
  #redraw = (): void => {
    this.requestUpdate();
  };

  /** The pose that has the indicator on the picked segment (or hidden). */
  #pose(): IndicatorPose | undefined {
    const picked = this.#segments.find((s) => this.#isPicked(s));
    const label = picked && this.#labelOf(picked);
    const track = this.track;
    if (!track) return undefined;
    // Rects are on screen: undo any scale an ancestor has (a pressed card).
    const box = track.getBoundingClientRect();
    const k =
      box.width && track.offsetWidth ? box.width / track.offsetWidth : 1;
    const inner = (n: number) => (n - box.left) / k - track.clientLeft;
    this.#bounds = {
      min: 0,
      max: track.clientWidth,
    };
    if (!label?.isConnected) {
      const t = this.#motion.target;
      return { l: t?.l ?? 0, r: t?.r ?? 0, o: 0 };
    }
    const r = label.getBoundingClientRect();
    if (r.width === 0) return undefined;
    return { l: inner(r.left), r: inner(r.right), o: 1 };
  }

  /** Puts the indicator where the stylesheet cannot: the pose it rests at. */
  #rest(): void {
    const t = this.#motion.target;
    if (t) Object.assign(this.indicator.style, indicatorLook(t, this.#bounds));
  }

  /** Layout changed (a resize, a font, a new segment): no move, just follow. */
  #follow(): void {
    const pose = this.#pose();
    if (!pose) return;
    this.#motion.snap(pose);
    this.#rest();
  }

  /** The value changed: slide (or fade) to the new segment. */
  #slide(): void {
    const to = this.#pose();
    if (!to) return;
    const from = this.#motion.target;
    if (!from || !canAnimate(this, this.indicator)) {
      this.#motion.snap(to);
      return this.#rest();
    }
    // From nothing: appear in place. To nothing: fade where it is.
    const appearing = from.o === 0 && to.o === 1;
    if (appearing) this.#motion.snap({ ...to, o: 0 });
    const lead = this.#leadingEdge(from, to);
    this.#motion.go(
      to,
      (key): Tune => (key === 'o' ? FADE : key === lead ? LEAD : TRAIL),
      () => this.#rest(),
    );
  }

  /** The edge that goes first: the right one moving right, the left one moving left. */
  #leadingEdge(from: IndicatorPose, to: IndicatorPose): 'l' | 'r' {
    return to.l + to.r >= from.l + from.r ? 'r' : 'l';
  }

  /** The native `input` event reaches the host as it is; take the value first. */
  #onInput(segment: PrismSegment): void {
    this.value = segment.value;
    this.#validity.touch();
  }

  /** A native `change` stays inside the shadow root, so say it again on the host. */
  #onChange(): void {
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  #onFocusOut = (event: FocusEvent): void => {
    if (!this.group.contains(event.relatedTarget as Node | null))
      this.#validity.touch();
  };

  #renderSegment(segment: PrismSegment) {
    const off = this.#isOff(segment);
    const state = `${this.#isPicked(segment) ? ' checked' : ''}${off ? ' disabled' : ''}`;
    return html`<label part="segment${state}">
      <input
        part="base${state}"
        type="radio"
        name=${this.#id}
        .checked=${this.#isPicked(segment)}
        ?required=${this.required}
        ?disabled=${off}
        ${ref((el) => (segment.input = (el as HTMLInputElement) ?? null))}
        @input=${() => this.#onInput(segment)}
        @change=${() => this.#onChange()}
      />
      <slot name=${segment.slot} @slotchange=${this.#redraw}></slot>
    </label>`;
  }

  override render() {
    return html`<fieldset part="group" @focusout=${this.#onFocusOut}>
      <legend part="label" class=${this.hideLabel ? 'visually-hidden' : ''}>
        ${this.label}
      </legend>
      ${renderDescription(this.#id)}
      <div part="track">
        <div part="indicator" style="opacity: 0"></div>
        ${repeat(
          this.#segments,
          (segment) => segment,
          (segment) => this.#renderSegment(segment),
        )}
        <slot @slotchange=${this.#redraw}></slot>
      </div>
      ${renderError(this.#id)}
    </fieldset>`;
  }
}
