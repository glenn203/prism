import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  POP_OFF,
  POP_ON,
  canAnimate,
  clamp,
  num,
  prefersReducedMotion,
  squish,
  squishTune,
} from '../internal/choice-motion.js';
import { choiceStyles } from '../internal/choice-styles.js';
import {
  renderDescription,
  renderError,
  syncFieldA11y,
} from '../internal/field-parts.js';
import { FieldValidityController } from '../internal/field-validity.js';
import { FormAssociated } from '../internal/form-associated.js';
import { uniqueId } from '../internal/ids.js';
import { Press } from '../internal/press.js';
import {
  SpringMotion,
  type Pose,
  type Tune,
} from '../internal/spring-motion.js';
import { stateLayer } from '../internal/state-layer.js';
import { visuallyHidden } from '../internal/visually-hidden.js';

/*
 * Motion model. A pose of four numbers, each on its own spring, drawn by one
 * pure function, so the box, the fill, the mark and the light pass all come
 * from the same clock and cannot drift apart:
 *   q  squish: 0 at rest, 1 held down; below 0 is the stretch of the pop.
 *   f  fill: 0 empty, 1 filled (a circle growing from the centre).
 *   c  check: how far the check is drawn; past 1 is the tiny overshoot.
 *   m  dash: how far the indeterminate dash is drawn.
 * The mark is two arms that meet at one corner. Drawn out they are the check;
 * flattened and centred they are the dash, so one turns into the other by
 * rotating and sliding the arms rather than swapping shapes.
 */
type Key = 'q' | 'f' | 'c' | 'm';
type Layer = 'box' | 'fill' | 'armA' | 'armB' | 'glint';

const TUNE: Record<Exclude<Key, 'q'>, Tune> = {
  f: { w: 30, z: 0.8 },
  c: { w: 17, z: 0.7 },
  m: { w: 18, z: 0.9 },
};

/** The longest an arm can be drawn: the long arm plus its overshoot (a 20-unit box). */
const ARM_MAX = 10.6;
const CHECK = { x: 8.6, y: 13.8, a: [225, 4.81], b: [-50, 9.65] } as const;
const DASH = { x: 10, y: 10, a: [180, 5], b: [0, 5] } as const;

/** Length of the whole check, drawn as one stroke: the short arm, then the long one. */
const CHECK_LENGTH = CHECK.a[1] + CHECK.b[1];
/** Check progress at which the stroke starts, so the fill leads. */
const PEN_DOWN = 0.2;

/**
 * One arm of the mark at this pose. The check is one stroke, drawn at check
 * progress `c` (past 1 is the overshoot), the short arm first; the dash grows
 * with `m`. Both turn about the corner, so one becomes the other.
 */
function arm(pose: Pose<Key>, side: 'a' | 'b'): Keyframe {
  const c = Math.max(0, pose.c);
  const m = clamp(pose.m);
  const [checkAngle, checkLen] = CHECK[side];
  const [dashAngle, dashLen] = DASH[side];
  // How much of the mark is check rather than dash. Below a quarter of the
  // way in the arms are too short to see, so it ramps: the angle never jumps
  // when the check starts from nothing.
  const weight = c / Math.max(c + m, 0.25);
  const angle = weight * checkAngle + (1 - weight) * dashAngle;
  // From the dash there is no fill to wait for: the stroke starts at once and
  // both arms grow together, so the mark never shrinks on its way to a check.
  const down = PEN_DOWN * (1 - m);
  const done = clamp((c - down) / (1 - down), 0, 1.1);
  const stroke = done * CHECK_LENGTH;
  const inOrder =
    side === 'a'
      ? Math.min(checkLen, stroke)
      : Math.max(0, stroke - CHECK.a[1]);
  const drawn = (1 - m) * inOrder + m * checkLen * done;
  const length = Math.min(ARM_MAX, weight * drawn + (1 - weight) * dashLen * m);
  const x = DASH.x + c * (CHECK.x - DASH.x);
  const y = DASH.y + c * (CHECK.y - DASH.y);
  return {
    transform: `translate(${num(x)}px, ${num(y)}px) rotate(${num(angle)}deg)`,
    strokeDashoffset: num(ARM_MAX - length),
    opacity: num(clamp(length)),
  };
}

/** Everything drawn at one pose. */
function draw(pose: Pose<Key>): Record<Layer, Keyframe> {
  const fill = clamp(pose.f);
  return {
    box: squish(pose.q),
    fill: {
      transform: `scale(${num(fill)})`,
      opacity: num(clamp(fill * 3)),
    },
    armA: arm(pose, 'a'),
    armB: arm(pose, 'b'),
    glint: {
      transform: `translateX(${num(-100 + 200 * fill)}%)`,
      opacity: num(0.9 * Math.sin(Math.PI * fill)),
    },
  };
}

/**
 * A checkbox: a yes or no choice that is saved with a form, or a way to pick
 * items from a list. Use a switch for a setting that applies at once, and
 * radios when exactly one of several choices must be picked.
 *
 * - A native `<input type="checkbox">` in shadow DOM, drawn over with a box
 *   and mark. Space, label clicks and the tab order are the browser's, and
 *   indeterminate shows as `mixed` with no script.
 * - Named by `label` (and any default-slot content) through a real `<label>`.
 *   The label is visible by default; `hide-label` hides it from sight only.
 *   Put help text in the `description` slot and the message for a failed check
 *   in the `error` slot.
 * - Joins the surrounding form: submits `value` (default "on") under `name`
 *   while checked, and nothing otherwise. `required` makes an unchecked box
 *   fail validation. Resets to its starting state with the form. The native
 *   input lives in shadow DOM, so the host mirrors its value and validity
 *   through ElementInternals.
 * - `indeterminate` is for a parent of a partly picked group. The next user
 *   click clears it and toggles the box, as a native checkbox does.
 * - Fires `input` and `change` after each user toggle.
 * - Motion: pressing squishes the box; letting go springs it back with a
 *   small pop. Checking grows the fill out of the centre, then draws the
 *   check in with a tiny overshoot, in about 450ms; unchecking runs it back.
 *   The indeterminate dash and the check turn into each other. A tap during a
 *   move turns it round from where it is, with its speed. A soft pass of
 *   light crosses the fill as it grows. Transform and opacity move, and the
 *   check's stroke offset draws it in (paint only, no layout). Nothing
 *   animates on first paint; a change from code moves the same way as a
 *   click. Under `prefers-reduced-motion: reduce` the state changes at once
 *   and the colour fades over 120ms.
 * - State is never colour alone: the check or dash is drawn on the fill.
 * - The hover, selected and pressed fills come from the shared state layer.
 *
 * @tag prism-checkbox
 * @slot - Extra label content, shown after `label`.
 * @slot description - Help text under the label.
 * @slot error - Message shown while the checkbox is invalid.
 * @csspart container - Wraps the control and its text.
 * @csspart control - Wraps the input and the drawn box; the 24px minimum hit area.
 * @csspart base - The native checkbox input, laid over the whole control; it carries the focus ring.
 * @csspart box - The drawn box (squishes while pressed).
 * @csspart edge - The resting border.
 * @csspart fill - The accent fill that grows from the centre.
 * @csspart mark - The svg holding the check and dash.
 * @csspart text - The label column.
 * @csspart label - The visible label.
 * @csspart description - The help text.
 * @csspart error - The error message.
 * @cssstate checked - The checkbox is checked.
 * @cssstate indeterminate - The checkbox is indeterminate.
 * @cssstate selected - Checked or indeterminate.
 * @cssstate disabled - The checkbox is disabled.
 * @cssstate invalid - Fails validation (after interaction or submit).
 * @fires input - After the user toggles the checkbox.
 * @fires change - After the user toggles the checkbox.
 */
export class PrismCheckbox extends FormAssociated(LitElement) {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles = [
    visuallyHidden,
    choiceStyles,
    css`
      /* The input fills the control and is invisible; the box is drawn above it. */
      [part='base'],
      [part='box'] {
        grid-area: 1 / 1;
      }
      [part='mark'] {
        position: absolute;
        inset: 0;
        z-index: 4;
        inline-size: 100%;
        block-size: 100%;
        fill: none;
        stroke: currentcolor;
        stroke-width: 2;
        stroke-linecap: round;
      }
      [part='mark'] line {
        stroke-dasharray: ${ARM_MAX};
        transform-box: view-box;
        transform-origin: 0 0;
      }
      [part='fill'] {
        position: absolute;
        inset: -25%;
        border-radius: 50%;
      }
      /* A pass of light across the fill while it grows; nothing at rest. */
      [part='box']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 2;
        background: linear-gradient(
          105deg,
          transparent 30%,
          rgb(255 255 255 / 0.45) 50%,
          transparent 70%
        );
        opacity: 0;
        transform: translateX(-100%);
      }
      @media (prefers-reduced-motion: reduce) {
        [part='box']::before {
          display: none;
        }
      }
    `,
    stateLayer("[part='control']"),
    // After the state layer: its overlay is drawn by the box, above the fill.
    css`
      [part='control'] {
        background-image: none;
      }
    `,
  ];

  /** Checked when set. Reflected. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** Neither checked nor unchecked: a parent of a partly picked group. Reflected. */
  @property({ type: Boolean, reflect: true }) indeterminate = false;

  /** Value submitted with the form while checked. */
  @property() value = 'on';

  /** Required. What the checkbox is for: "Email me a summary". */
  @property() label = '';

  /** Hides the label from sight (it still names the checkbox). */
  @property({ type: Boolean, attribute: 'hide-label' }) hideLabel = false;

  /** The box must be checked for the form to submit. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Size: sm, md or lg. */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';

  @query('[part="base"]') private readonly base!: HTMLInputElement;

  readonly #id = uniqueId('prism-checkbox');
  readonly #validity = new FieldValidityController(this);
  readonly #press = new Press(
    this,
    () => !this.isDisabled && !prefersReducedMotion(),
    () => this.#retarget(),
  );
  readonly #motion = new SpringMotion<Key, Layer>(
    ['q', 'f', 'c', 'm'],
    {
      box: { el: () => this.#part('box') },
      fill: { el: () => this.#part('fill') },
      armA: { el: () => this.#part('mark')?.firstElementChild },
      armB: { el: () => this.#part('mark')?.lastElementChild },
      glint: { el: () => this.#part('box'), pseudo: '::before' },
    },
    draw,
  );
  #defaultChecked?: boolean;
  /** False until the first render is on screen: nothing animates before it. */
  #ready = false;

  override connectedCallback(): void {
    super.connectedCallback();
    // The first value seen is what a form reset goes back to.
    this.#defaultChecked ??= this.checked;
    if (this.#ready) this.#motion.snap(this.#pose());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#motion.stop();
    this.#press.clear();
  }

  override focus(options?: FocusOptions): void {
    this.base?.focus(options);
  }

  /** Toggles the checkbox as if the user had pressed it. */
  override click(): void {
    this.base?.click();
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
    this.checked = this.#defaultChecked ?? false;
    this.#validity.reset();
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    this.checked = state === 'on';
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    this.setState('checked', this.#isOn);
    this.setState('indeterminate', this.indeterminate);
    this.setState('selected', this.#isOn || this.indeterminate);
    if (changed.has('checked') || changed.has('value')) {
      this.internals.setFormValue(
        this.checked ? this.value : null,
        this.checked ? 'on' : 'off',
      );
    }
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!this.label && !this.textContent?.trim())
      console.error(
        '[prism-checkbox] `label` is required: a checkbox needs an accessible name.',
        this,
      );
    this.internals.setValidity(
      this.required && !this.checked ? { valueMissing: true } : {},
      'Check this box to continue.',
      this.base,
    );
    syncFieldA11y(this.renderRoot, this.base, this.#id, this.#validity.sync());
    if (!this.#ready) {
      // The first render lands at rest, with no move.
      this.#ready = true;
      this.#motion.snap(this.#pose());
    } else if (changed.has('checked') || changed.has('indeterminate')) {
      // Any change of state, by the user or by code, moves the same way.
      this.#retarget(this.#isOn ? POP_ON : POP_OFF);
    }
  }

  /** Takes the native input's new state; its own `input` event reaches the host as it is. */
  #onInput(): void {
    this.checked = this.base.checked;
    this.indeterminate = this.base.indeterminate;
    this.#validity.touch();
  }

  /** A native `change` stays inside the shadow root, so say it again on the host. */
  #onChange(): void {
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Checked, and not showing as indeterminate. */
  get #isOn(): boolean {
    return this.checked && !this.indeterminate;
  }

  #part(name: string): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[part="${name}"]`);
  }

  /** The pose for the current state, held down or not. */
  #pose(): Pose<Key> {
    return {
      q: this.#press.held ? 1 : 0,
      f: this.#isOn || this.indeterminate ? 1 : 0,
      c: this.#isOn ? 1 : 0,
      m: this.indeterminate ? 1 : 0,
    };
  }

  /** Moves to the current pose; `pop` is the extra push when the state flips. */
  #retarget(pop = 0): void {
    const pose = this.#pose();
    if (!this.#ready || !canAnimate(this, this.#part('box')))
      return this.#motion.snap(pose);
    this.#motion.go(pose, (key) =>
      key === 'q' ? squishTune(pose.q > 0, pop) : TUNE[key],
    );
  }

  override render() {
    const rest = draw(this.#pose());
    return html`<div part="container">
      <span part="control">
        <input
          part="base"
          id="control"
          type="checkbox"
          .checked=${this.checked}
          .indeterminate=${this.indeterminate}
          ?required=${this.required}
          ?disabled=${this.isDisabled}
          @input=${() => this.#onInput()}
          @change=${() => this.#onChange()}
          @keydown=${this.#press.down}
          @keyup=${this.#press.up}
          @blur=${this.#press.up}
          @pointerdown=${this.#press.down}
          @pointerup=${this.#press.up}
          @pointercancel=${this.#press.up}
          @pointerleave=${this.#press.up}
        />
        <span part="box" style=${styleMap(rest.box)}>
          <span part="edge"></span>
          <span part="fill" style=${styleMap(rest.fill)}></span>
          <svg part="mark" viewBox="0 0 20 20" aria-hidden="true">
            <line x2=${ARM_MAX} style=${styleMap(rest.armA)}></line>
            <line x2=${ARM_MAX} style=${styleMap(rest.armB)}></line>
          </svg>
        </span>
      </span>
      <div part="text">
        <label
          part="label"
          for="control"
          class=${this.hideLabel ? 'visually-hidden' : ''}
          >${this.label}<slot></slot
        ></label>
        ${renderDescription(this.#id)} ${renderError(this.#id)}
      </div>
    </div>`;
  }
}
