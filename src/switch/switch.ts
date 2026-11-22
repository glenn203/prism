import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { FormAssociated } from '../internal/form-associated.js';
import { textRole } from '../internal/control-styles.js';
import { stateLayer } from '../internal/state-layer.js';
import { visuallyHidden } from '../internal/visually-hidden.js';
import { settleTime, springAt, type Spring } from '../internal/spring.js';

/*
 * Motion model. The thumb is two edges, each on its own spring: the edge
 * leading the move is stiff, the trailing edge is softer, so the thumb
 * stretches while it travels and snaps back into shape as it lands. A spring
 * has no fixed start, so a move can be taken over mid-flight (a second tap, a
 * drag release) from the exact position and speed it had. Everything drawn is
 * a function of the two edges (thumb, track fill, border and thumb colour,
 * glint), sampled from one clock, so nothing can drift out of step.
 * Transform and opacity only, run by the Web Animations API off the main thread.
 */
const NOMINAL_MS = 400;
/** Leading edge: quick, a little overshoot. Trailing edge: softer, no real overshoot. */
const LEAD = { w: 25, z: 0.7 };
const TRAIL = { w: 16, z: 0.78 };
/** Press and release: a short, nearly critical spring. */
const PRESS = { w: 28, z: 0.9 };
/** How much wider (of the thumb's width) the thumb gets while held. */
const PRESS_GROW = 0.22;
/** Pointer travel before a press becomes a drag (px). */
const DRAG_START = 4;
/** Release speed that decides a drag on its own (px/s). */
const FLICK = 260;
/** Keyframe spacing (ms). */
const STEP = 8;
/**
 * A new animation shows its first frame at its start. Taking over from where
 * the last frame was drawn would draw that same pose twice, a stalled frame;
 * so a take-over starts one frame ahead (ms).
 */
const FRAME = 16.7;

interface Geo {
  inner: number;
  tw: number;
  inset: number;
  /** Travel of the thumb's start edge, off to on. */
  T: number;
  /** 1, or -1 in rtl. */
  dir: 1 | -1;
  /** Extra width while held. */
  pe: number;
}
/** The two edges (px from the thumb's off position) and their speeds (px/s). */
interface Pose {
  a: number;
  b: number;
  va: number;
  vb: number;
}
interface Sim {
  a: Spring;
  b: Spring;
  to: { a: number; b: number };
  /** A move between states, not a press or release. */
  move: boolean;
  /** ms */
  dur: number;
}
interface Drag {
  id: number;
  x0: number;
  active: boolean;
  /** Thumb centre when the drag began, and the pointer x it is measured from. */
  c0: number;
  pose: Pose;
  samples: { t: number; c: number }[];
  geo?: Geo;
  tc?: Animation;
  bc?: Animation;
}
interface Frame {
  s: number;
  thumb: string;
  wash: string;
  glintX: string;
  glintO: string;
}
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * A switch: an on/off control that takes effect right away, like a light
 * switch. Use it for a setting ("Auto-refresh"), not for a choice that is only
 * saved when a form is submitted (use a checkbox there).
 *
 * - A native `<button role="switch" aria-checked>` in shadow DOM, so Space and
 *   Enter toggle it and it takes part in the tab order.
 * - Named by `label` (and any default-slot content). The label is visible by
 *   default; `hide-label` hides it from sight only.
 * - Joins the surrounding form: submits `value` (default "on") under `name`
 *   while on, and nothing while off. Resets to its starting state with the form.
 * - Fires `input` and `change` after each user toggle.
 * - Motion: one spring-driven move, about 400ms either way. The thumb's
 *   leading edge runs ahead and its trailing edge follows, so it stretches
 *   mid-travel and settles into shape with a slight overshoot; the track fill,
 *   border and thumb colour are driven by the same position, so they can never
 *   drift out of step. A second tap mid-move turns it around from where it
 *   is, with its speed. Pressing and holding widens the thumb; dragging it
 *   past the middle (or flicking it) turns the switch on release. Only
 *   transform and opacity move. Nothing animates on first paint. Under
 *   `prefers-reduced-motion: reduce` there is no travel, stretch, press or drag
 *   motion: the thumb jumps and the colour changes over 120ms.
 * - State is never colour alone: the thumb sits at the start when off and at
 *   the end when on.
 * - The hover, selected and pressed fills come from the shared state layer.
 *
 * @tag prism-switch
 * @slot - Extra label content, shown after `label`.
 * @csspart container - Wraps the control and its label.
 * @csspart base - The native button, drawn as the track.
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
        all: unset;
        box-sizing: border-box;
        position: relative;
        flex: none;
        inline-size: var(--_w);
        block-size: var(--_h);
        overflow: hidden;
        border-width: var(--_bd);
        border-style: solid;
        border-color: transparent;
        border-radius: var(--prism-radius-full, 9999px);
        cursor: var(--prism-switch-cursor, pointer);
        /* A sideways drag turns the switch; up and down still scrolls. */
        touch-action: pan-y;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      [part='base']:disabled {
        cursor: var(--prism-switch-cursor-disabled, default);
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
      [aria-checked='true'] > [part='wash'] {
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
      /* A pass of light across the track while the thumb moves. Its place
         and strength follow the thumb: nothing at rest. */
      [part='base']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 1;
        border-radius: inherit;
        background: linear-gradient(
          105deg,
          transparent 30%,
          rgb(255 255 255 / 0.45) 50%,
          transparent 70%
        );
        opacity: var(--_go, 0);
        transform: translateX(var(--_gx, -100%));
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
      [aria-checked='true'] > [part='thumb'] {
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
        [aria-checked='true'] > [part='wash'] {
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

  @query('[part="base"]') private readonly button!: HTMLButtonElement;
  @query('[part="thumb"]') private readonly thumb!: HTMLElement;
  @query('[part="wash"]') private readonly wash!: HTMLElement;

  #defaultChecked?: boolean;
  /** False until the first render is on screen: nothing animates before it. */
  #ready = false;
  #pressing = false;
  #suppressClick = false;
  #drag?: Drag;
  /** Where a released drag was, so the move that follows starts from there. */
  #hold?: Pose;
  /** The running move, if any. */
  #sim?: Sim;
  #anims: Animation[] = [];
  #master?: Animation;

  override connectedCallback(): void {
    super.connectedCallback();
    // The first value seen is what a form reset goes back to.
    this.#defaultChecked ??= this.checked;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#clear();
    this.#drag = undefined;
    this.#pressing = false;
  }

  override focus(options?: FocusOptions): void {
    this.button?.focus(options);
  }

  /** Toggles the switch as if the user had pressed it. */
  override click(): void {
    this.button?.click();
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
        '[prism-switch] `label` is required: a switch needs an accessible name.',
        this,
      );
    if (!this.#ready) {
      // The first render lands at rest, with no move.
      this.#ready = true;
      return;
    }
    if (changed.has('size')) this.#clear();
    if (changed.has('checked')) {
      // Any change of state, by the user or by code, moves the same way.
      this.#retarget(Boolean(changed.get('checked')));
    }
  }

  #toggle(): void {
    if (this.isDisabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  #onClick = (event: Event): void => {
    if (this.#suppressClick) {
      // The click that follows a drag or a release outside the track.
      this.#suppressClick = false;
      event.preventDefault();
      return;
    }
    this.#toggle();
  };

  // ---- measuring ----

  #reduced(): boolean {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  #canMove(): boolean {
    return (
      this.#ready &&
      this.isConnected &&
      !!this.thumb &&
      typeof this.thumb.animate === 'function' &&
      !this.#reduced()
    );
  }

  #measure(): Geo | undefined {
    const base = this.button;
    const thumb = this.thumb;
    if (!base || !thumb) return undefined;
    const b = getComputedStyle(base);
    const t = getComputedStyle(thumb);
    const bd = parseFloat(b.borderTopWidth) || 0;
    const inner = base.getBoundingClientRect().width - 2 * bd;
    const tw = parseFloat(t.width);
    const inset = parseFloat(t.top);
    const T = inner - 2 * inset - tw;
    if (!(inner > 0) || !(tw > 0) || !(T > 0)) return undefined;
    const dir = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    return { inner, tw, inset, T, dir, pe: tw * PRESS_GROW };
  }

  /** Ms a full move takes: --prism-switch-duration, or 400. */
  #duration(): number {
    const raw = getComputedStyle(this).getPropertyValue('--_dur-on').trim();
    const n = parseFloat(raw);
    if (!raw || Number.isNaN(n) || n <= 0) return NOMINAL_MS;
    return raw.endsWith('ms') ? n : n * 1000;
  }

  /** The edges at rest (or held, while pressed) for the current state. */
  #target(g: Geo, checked = this.checked): { a: number; b: number } {
    const rest = checked ? g.T : 0;
    let a = rest;
    let b = rest + g.tw;
    if (this.#pressing && !this.isDisabled) {
      if (checked) a = g.T - g.pe;
      else b = g.tw + g.pe;
    }
    return { a, b };
  }

  /** Where the thumb is right now, with its speed. */
  #now(g: Geo, wasChecked: boolean): Pose {
    if (this.#drag?.active) return { ...this.#drag.pose };
    if (this.#hold) return { ...this.#hold };
    const sim = this.#sim;
    const master = this.#master;
    if (sim && master) {
      const ms = Math.min(Number(master.currentTime ?? 0) + FRAME, sim.dur);
      const t = ms / 1000;
      const [xa, va] = springAt(sim.a, t);
      const [xb, vb] = springAt(sim.b, t);
      return { a: sim.to.a + xa, b: sim.to.b + xb, va, vb };
    }
    const r = wasChecked ? g.T : 0;
    return { a: r, b: r + g.tw, va: 0, vb: 0 };
  }

  // ---- the move ----

  #clear(): void {
    for (const a of this.#anims) a.cancel();
    this.#anims = [];
    this.#master = undefined;
    this.#sim = undefined;
    this.#hold = undefined;
  }

  /** Colours at rest for each state, read with no animation running. */
  #colors(checked: boolean): { thumb: string; border: string } {
    const read = () => ({
      thumb: getComputedStyle(this.thumb).backgroundColor,
      border: getComputedStyle(this.button).borderTopColor,
    });
    if (checked === this.checked) return read();
    this.setState('checked', checked);
    const c = read();
    this.setState('checked', this.checked);
    return c;
  }

  /**
   * Everything drawn at one pose of the thumb: the thumb itself, the track
   * fill, the glint, and `s`, how far the colours have gone from off to on.
   */
  #frame(g: Geo, a: number, b: number): Frame {
    const lo = g.pe / (2 * g.T);
    const mid = (a + b) / 2;
    const p = (mid - g.tw / 2) / g.T;
    const s = clamp01((p - lo) / (1 - 2 * lo));
    const cx = g.inset + mid;
    const left = g.dir > 0 ? cx : g.inner - cx;
    return {
      s,
      thumb: `translateX(${(g.dir * a).toFixed(3)}px) scaleX(${(
        (b - a) /
        g.tw
      ).toFixed(4)})`,
      wash: `translateX(${left.toFixed(3)}px) scale(${clamp01(s * 1.1).toFixed(4)})`,
      glintX: `${(g.dir * (-100 + 200 * s)).toFixed(2)}%`,
      glintO: (0.9 * Math.sin(Math.PI * s)).toFixed(4),
    };
  }

  /** Easing that maps a move's time to its colour progress, sample by sample. */
  #colorEase(values: number[]): string {
    if (!CSS.supports('animation-timing-function', 'linear(0, 1)'))
      return 'linear';
    return `linear(${values.map((v) => clamp01(v).toFixed(4)).join(', ')})`;
  }

  /**
   * Starts (or takes over) the move to the current state. Reads the thumb's
   * position and speed from the move in flight, so turning round mid-way, or
   * letting go of a drag, carries on from exactly there.
   */
  #retarget(wasChecked: boolean): void {
    if (!this.#canMove()) {
      this.#clear();
      return;
    }
    const g = this.#measure();
    if (!g) {
      this.#clear();
      return;
    }
    const cur = this.#now(g, wasChecked);
    const to = this.#target(g);
    const moved = wasChecked !== this.checked;
    const k = NOMINAL_MS / this.#duration();
    let sa: Spring;
    let sb: Spring;
    if (moved) {
      // The edge heading for the destination leads; the other follows.
      const lead = { ...LEAD, w: LEAD.w * k };
      const trail = { ...TRAIL, w: TRAIL.w * k };
      const toEnd = this.checked;
      sa = { x0: cur.a - to.a, v0: cur.va, ...(toEnd ? trail : lead) };
      sb = { x0: cur.b - to.b, v0: cur.vb, ...(toEnd ? lead : trail) };
    } else {
      const press = { ...PRESS, w: PRESS.w * k };
      sa = { x0: cur.a - to.a, v0: cur.va, ...press };
      sb = { x0: cur.b - to.b, v0: cur.vb, ...press };
    }
    this.#hold = undefined;
    // Already heading there (a release timer after a click): leave it be.
    const sim = this.#sim;
    if (
      !moved &&
      sim &&
      Math.abs(sim.to.a - to.a) < 0.01 &&
      Math.abs(sim.to.b - to.b) < 0.01
    )
      return;
    const still =
      Math.abs(sa.x0) < 0.01 &&
      Math.abs(sb.x0) < 0.01 &&
      Math.abs(sa.v0) < 0.5 &&
      Math.abs(sb.v0) < 0.5;
    if (still && !this.#sim) return;

    // Colours at each end, read with the old move out of the way.
    this.#clear();
    const off = this.#colors(false);
    const on = this.#colors(true);

    const dur = Math.max(60, Math.round(settleTime([sa, sb]) * 1000));
    const n = Math.max(2, Math.ceil(dur / STEP));
    const thumb: Keyframe[] = [];
    const wash: Keyframe[] = [];
    const glint: Keyframe[] = [];
    const ss: number[] = [];
    for (let i = 0; i <= n; i++) {
      const last = i === n;
      const t = (dur * i) / n / 1000;
      const a = last ? to.a : to.a + springAt(sa, t)[0];
      const b = last ? to.b : to.b + springAt(sb, t)[0];
      const f = this.#frame(g, a, Math.max(b, a + g.tw * 0.8));
      ss.push(f.s);
      thumb.push({ transform: f.thumb });
      wash.push({ transform: f.wash });
      glint.push({ transform: `translateX(${f.glintX})`, opacity: f.glintO });
    }
    const opts = (easing = 'linear'): KeyframeAnimationOptions => ({
      duration: dur,
      easing,
      fill: 'forwards',
    });
    const ease = this.#colorEase(ss);
    const master = this.thumb.animate(thumb, opts());
    this.#anims = [
      master,
      this.wash.animate(wash, opts()),
      this.button.animate(glint, { ...opts(), pseudoElement: '::before' }),
      this.thumb.animate(
        [{ backgroundColor: off.thumb }, { backgroundColor: on.thumb }],
        opts(ease),
      ),
      this.button.animate(
        [{ borderColor: off.border }, { borderColor: on.border }],
        opts(ease),
      ),
    ];
    this.#master = master;
    this.#sim = { a: sa, b: sb, to, move: moved, dur };
    master.onfinish = () => {
      if (this.#master !== master) return;
      // At rest the stylesheet draws exactly this; hand over to it, so a
      // later change of size or zoom is never stuck with stale pixels.
      if (this.#pressing) this.#retarget(this.checked);
      else this.#clear();
    };
  }

  // ---- press, drag ----

  #onPointerDown = (e: PointerEvent): void => {
    if (this.isDisabled || e.button !== 0 || !e.isPrimary || this.#reduced())
      return;
    this.#pressing = true;
    this.#drag = {
      id: e.pointerId,
      x0: e.clientX,
      active: false,
      c0: 0,
      pose: { a: 0, b: 0, va: 0, vb: 0 },
      samples: [],
    };
    try {
      this.button.setPointerCapture(e.pointerId);
    } catch {
      /* A synthetic event has no active pointer; the press still works. */
    }
    // Pressing during a move: let the move finish, then widen if still held.
    if (!(this.#sim?.move && this.#master?.playState === 'running'))
      this.#retarget(this.checked);
  };

  #onPointerMove = (e: PointerEvent): void => {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    const g = d.geo ?? this.#measure();
    if (!g) return;
    const dx = (e.clientX - d.x0) * g.dir;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_START) return;
      this.#startDrag(d, g);
    }
    // Centre limits: the held thumb against either end, with a little give.
    const w = g.tw + g.pe;
    const lo = w / 2;
    const hi = g.T + (g.tw - g.pe) / 2;
    const rub = (n: number) => 0.25 * n;
    let c = d.c0 + (dx - Math.sign(dx) * DRAG_START);
    if (c < lo) c = lo - rub(lo - c);
    else if (c > hi) c = hi + rub(c - hi);
    const now = performance.now();
    d.samples.push({ t: now, c });
    while (d.samples.length > 2 && now - d.samples[0]!.t > 100)
      d.samples.shift();
    const f = this.#frame(g, c - w / 2, c + w / 2);
    this.#paint(d, g, f, c);
  };

  #startDrag(d: Drag, g: Geo): void {
    const cur = this.#now(g, this.checked);
    d.geo = g;
    d.active = true;
    d.c0 = (cur.a + cur.b) / 2;
    d.pose = cur;
    // Colours follow the thumb through two paused animations: set the time
    // from the thumb's place, no timers.
    this.#clear();
    const off = this.#colors(false);
    const on = this.#colors(true);
    const o: KeyframeAnimationOptions = {
      duration: 1000,
      easing: 'linear',
      fill: 'both',
    };
    d.tc = this.thumb.animate(
      [{ backgroundColor: off.thumb }, { backgroundColor: on.thumb }],
      o,
    );
    d.bc = this.button.animate(
      [{ borderColor: off.border }, { borderColor: on.border }],
      o,
    );
    d.tc.pause();
    d.bc.pause();
  }

  #paint(d: Drag, g: Geo, f: Frame, c: number) {
    const w = g.tw + g.pe;
    d.pose = { a: c - w / 2, b: c + w / 2, va: 0, vb: 0 };
    this.thumb.style.transform = f.thumb;
    this.wash.style.transform = f.wash;
    this.button.style.setProperty('--_gx', f.glintX);
    this.button.style.setProperty('--_go', f.glintO);
    if (d.tc) d.tc.currentTime = f.s * 1000;
    if (d.bc) d.bc.currentTime = f.s * 1000;
  }

  #endPointer = (e: PointerEvent): void => {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#drag = undefined;
    this.#pressing = false;
    const rect = this.button.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!d.active) {
      // A plain press: a click follows if it ended on the switch.
      if (!inside || e.type === 'pointercancel') this.#suppressClick = true;
      window.setTimeout(() => {
        this.#suppressClick = false;
        if (!this.#drag) this.#retarget(this.checked);
      }, 0);
      return;
    }
    const g = d.geo!;
    // Drag release: the side it is on, or where a flick sends it.
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    let v = 0;
    if (first && last && last.t > first.t)
      v = ((last.c - first.c) / (last.t - first.t)) * 1000;
    const lo = (g.tw + g.pe) / 2;
    const hi = g.T + (g.tw - g.pe) / 2;
    const frac = (d.pose.a + d.pose.b) / 2;
    let on = (frac - lo) / (hi - lo) > 0.5;
    if (Math.abs(v) > FLICK) on = v > 0;
    if (e.type === 'pointercancel') on = this.checked;
    const lead = Math.max(-1, Math.min(1, (v * FRAME) / 1000 / g.T)) * g.T;
    this.#hold = {
      a: d.pose.a + lead,
      b: d.pose.b + lead,
      va: v,
      vb: v,
    };
    for (const a of [d.tc, d.bc]) a?.cancel();
    this.thumb.style.removeProperty('transform');
    this.wash.style.removeProperty('transform');
    this.button.style.removeProperty('--_gx');
    this.button.style.removeProperty('--_go');
    // The click that follows a drag is not a second toggle.
    this.#suppressClick = true;
    window.setTimeout(() => (this.#suppressClick = false), 0);
    if (on !== this.checked && !this.isDisabled) {
      this.checked = on;
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      this.#retarget(this.checked);
    }
  };

  override render() {
    return html`<div part="container">
      <button
        part="base"
        id="control"
        type="button"
        role="switch"
        aria-checked=${this.checked ? 'true' : 'false'}
        ?disabled=${this.isDisabled}
        @click=${this.#onClick}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#endPointer}
        @pointercancel=${this.#endPointer}
      >
        <span part="wash" aria-hidden="true"></span>
        <span part="thumb" aria-hidden="true"></span>
      </button>
      <label
        part="label"
        for="control"
        class=${this.hideLabel ? 'visually-hidden' : ''}
        >${this.label}<slot></slot
      ></label>
    </div>`;
  }
}
