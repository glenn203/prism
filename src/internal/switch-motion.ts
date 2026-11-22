import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { canPolishAnimate } from './choice-motion.js';
import { hasPolishEffect } from './polish-scope.js';
import { settleTime, springAt, type Spring } from './spring.js';

/**
 * Private. Switch polish motion: stretch, glint, press-grow, springs and
 * drag. Attaches to `prism-switch` and plays only inside a polish motion
 * scope (`data-prism-polish` with `motion`, `all`, or an empty attribute).
 * Springs work from the attribute even without polish.css; the glint styles
 * live in that sheet.
 */

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

export interface SwitchMotionHost extends ReactiveControllerHost, HTMLElement {
  checked: boolean;
  size: string;
  readonly isDisabled: boolean;
  setState(name: string, on: boolean): void;
}

export class SwitchMotion implements ReactiveController {
  #host: SwitchMotionHost;
  #base?: HTMLElement;
  #input?: HTMLInputElement;
  #thumb?: HTMLElement;
  #wash?: HTMLElement;
  #bound = false;
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
  #lastChecked = false;
  #lastSize = '';

  constructor(host: SwitchMotionHost) {
    this.#host = host;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.#clear();
    this.#drag = undefined;
    this.#pressing = false;
    this.#unbind();
  }

  /** Called from the switch after each update. */
  sync(): void {
    if (!this.#parts()) return;
    if (!this.#bound) this.#bind();
    if (!this.#ready) {
      this.#ready = true;
      this.#lastChecked = this.#host.checked;
      this.#lastSize = this.#host.size;
      return;
    }
    if (this.#host.size !== this.#lastSize) {
      this.#lastSize = this.#host.size;
      this.#clear();
    }
    if (this.#host.checked !== this.#lastChecked) {
      const was = this.#lastChecked;
      this.#lastChecked = this.#host.checked;
      this.#retarget(was);
    }
  }

  #parts(): boolean {
    const root = this.#host.shadowRoot;
    if (!root) return false;
    this.#base = root.querySelector<HTMLElement>('[part="base"]') ?? undefined;
    this.#input =
      root.querySelector<HTMLInputElement>('[part="base"] > input') ??
      undefined;
    this.#thumb =
      root.querySelector<HTMLElement>('[part="thumb"]') ?? undefined;
    this.#wash = root.querySelector<HTMLElement>('[part="wash"]') ?? undefined;
    return !!(this.#base && this.#input && this.#thumb && this.#wash);
  }

  #els():
    | {
        base: HTMLElement;
        thumb: HTMLElement;
        wash: HTMLElement;
        input: HTMLInputElement;
      }
    | undefined {
    const base = this.#base;
    const thumb = this.#thumb;
    const wash = this.#wash;
    const input = this.#input;
    if (!base || !thumb || !wash || !input) return undefined;
    return { base, thumb, wash, input };
  }

  #bind(): void {
    const input = this.#input;
    if (!input || this.#bound) return;
    input.addEventListener('click', this.#onClick);
    input.addEventListener('pointerdown', this.#onPointerDown);
    input.addEventListener('pointermove', this.#onPointerMove);
    input.addEventListener('pointerup', this.#endPointer);
    input.addEventListener('pointercancel', this.#endPointer);
    this.#bound = true;
  }

  #unbind(): void {
    const input = this.#input;
    if (!input || !this.#bound) return;
    input.removeEventListener('click', this.#onClick);
    input.removeEventListener('pointerdown', this.#onPointerDown);
    input.removeEventListener('pointermove', this.#onPointerMove);
    input.removeEventListener('pointerup', this.#endPointer);
    input.removeEventListener('pointercancel', this.#endPointer);
    this.#bound = false;
  }

  #onClick = (event: Event): void => {
    if (this.#suppressClick) {
      // The click that follows a drag or a release outside the track.
      this.#suppressClick = false;
      event.preventDefault();
    }
  };

  #reduced(): boolean {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  #canMove(): boolean {
    return this.#ready && canPolishAnimate(this.#host, this.#thumb ?? null);
  }

  #polishMotion(): boolean {
    return hasPolishEffect(this.#host, 'motion') && !this.#reduced();
  }

  #measure(): Geo | undefined {
    const base = this.#base;
    const thumb = this.#thumb;
    if (!base || !thumb) return undefined;
    const b = getComputedStyle(base);
    const t = getComputedStyle(thumb);
    const bd = parseFloat(b.borderTopWidth) || 0;
    const inner = base.getBoundingClientRect().width - 2 * bd;
    const tw = parseFloat(t.width);
    const inset = parseFloat(t.top);
    const T = inner - 2 * inset - tw;
    if (!(inner > 0) || !(tw > 0) || !(T > 0)) return undefined;
    const dir = getComputedStyle(this.#host).direction === 'rtl' ? -1 : 1;
    return { inner, tw, inset, T, dir, pe: tw * PRESS_GROW };
  }

  /** Ms a full move takes: --prism-switch-duration, or 400. */
  #duration(): number {
    const raw = getComputedStyle(this.#host)
      .getPropertyValue('--_dur-on')
      .trim();
    const n = parseFloat(raw);
    if (!raw || Number.isNaN(n) || n <= 0) return NOMINAL_MS;
    return raw.endsWith('ms') ? n : n * 1000;
  }

  /** The edges at rest (or held, while pressed) for the current state. */
  #target(g: Geo, checked = this.#host.checked): { a: number; b: number } {
    const rest = checked ? g.T : 0;
    let a = rest;
    let b = rest + g.tw;
    if (this.#pressing && !this.#host.isDisabled) {
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
    const els = this.#els();
    if (!els) return { thumb: '', border: '' };
    const read = () => ({
      thumb: getComputedStyle(els.thumb).backgroundColor,
      border: getComputedStyle(els.base).borderTopColor,
    });
    if (checked === this.#host.checked) return read();
    this.#host.setState('checked', checked);
    const c = read();
    this.#host.setState('checked', this.#host.checked);
    this.#host.setState('selected', this.#host.checked);
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
    const els = this.#els();
    if (!g || !els) {
      this.#clear();
      return;
    }
    const cur = this.#now(g, wasChecked);
    const to = this.#target(g);
    const moved = wasChecked !== this.#host.checked;
    const k = NOMINAL_MS / this.#duration();
    let sa: Spring;
    let sb: Spring;
    if (moved) {
      // The edge heading for the destination leads; the other follows.
      const lead = { ...LEAD, w: LEAD.w * k };
      const trail = { ...TRAIL, w: TRAIL.w * k };
      const toEnd = this.#host.checked;
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
    const master = els.thumb.animate(thumb, opts());
    this.#anims = [
      master,
      els.wash.animate(wash, opts()),
      els.base.animate(glint, { ...opts(), pseudoElement: '::before' }),
      els.thumb.animate(
        [{ backgroundColor: off.thumb }, { backgroundColor: on.thumb }],
        opts(ease),
      ),
      els.base.animate(
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
      if (this.#pressing) this.#retarget(this.#host.checked);
      else this.#clear();
    };
  }

  // ---- press, drag ----

  #onPointerDown = (e: PointerEvent): void => {
    if (
      this.#host.isDisabled ||
      e.button !== 0 ||
      !e.isPrimary ||
      !this.#polishMotion()
    )
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
      this.#els()?.input.setPointerCapture(e.pointerId);
    } catch {
      /* A synthetic event has no active pointer; the press still works. */
    }
    // Pressing during a move: let the move finish, then widen if still held.
    if (!(this.#sim?.move && this.#master?.playState === 'running'))
      this.#retarget(this.#host.checked);
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
    const cur = this.#now(g, this.#host.checked);
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
    const els = this.#els();
    if (!els) return;
    d.tc = els.thumb.animate(
      [{ backgroundColor: off.thumb }, { backgroundColor: on.thumb }],
      o,
    );
    d.bc = els.base.animate(
      [{ borderColor: off.border }, { borderColor: on.border }],
      o,
    );
    d.tc.pause();
    d.bc.pause();
  }

  #paint(d: Drag, g: Geo, f: Frame, c: number) {
    const els = this.#els();
    if (!els) return;
    const w = g.tw + g.pe;
    d.pose = { a: c - w / 2, b: c + w / 2, va: 0, vb: 0 };
    els.thumb.style.transform = f.thumb;
    els.wash.style.transform = f.wash;
    els.base.style.setProperty('--_gx', f.glintX);
    els.base.style.setProperty('--_go', f.glintO);
    if (d.tc) d.tc.currentTime = f.s * 1000;
    if (d.bc) d.bc.currentTime = f.s * 1000;
  }

  #endPointer = (e: PointerEvent): void => {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#drag = undefined;
    this.#pressing = false;
    const els = this.#els();
    if (!els) return;
    const rect = els.base.getBoundingClientRect();
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
        if (!this.#drag) this.#retarget(this.#host.checked);
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
    if (e.type === 'pointercancel') on = this.#host.checked;
    const lead = Math.max(-1, Math.min(1, (v * FRAME) / 1000 / g.T)) * g.T;
    this.#hold = {
      a: d.pose.a + lead,
      b: d.pose.b + lead,
      va: v,
      vb: v,
    };
    for (const a of [d.tc, d.bc]) a?.cancel();
    els.thumb.style.removeProperty('transform');
    els.wash.style.removeProperty('transform');
    els.base.style.removeProperty('--_gx');
    els.base.style.removeProperty('--_go');
    // The click that follows a drag is not a second toggle.
    this.#suppressClick = true;
    window.setTimeout(() => (this.#suppressClick = false), 0);
    if (on !== this.#host.checked && !this.#host.isDisabled) {
      this.#host.checked = on;
      this.#host.dispatchEvent(
        new Event('input', { bubbles: true, composed: true }),
      );
      this.#host.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      this.#retarget(this.#host.checked);
    }
  };
}
