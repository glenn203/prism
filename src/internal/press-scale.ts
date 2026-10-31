import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { canAnimate } from './choice-motion.js';
import { Press } from './press.js';
import { SpringMotion, type Tune } from './spring-motion.js';

/**
 * Private. The press of a button-like control: the whole control scales evenly
 * (never squashed, so text and icons keep their shape) while held, and eases
 * back to full size on release, never past it. One shared spring for every control, so
 * a tag and a button feel like the same material.
 *
 * It moves the CSS `scale` property, not `transform`, so it stacks with a
 * transform the control already has (a card's tilt). Pointer and key events are
 * heard on the host, whose box does not shrink, so the pointer never "leaves"
 * a control that has just got smaller under it.
 */

/** Pressing in: quick and nearly critical. */
export const PRESS_IN: Tune = { w: 60, z: 0.9 };
/** Letting go: critically damped, so it eases back to full size without passing it, settled in about a quarter of a second. */
export const PRESS_OUT: Tune = { w: 24, z: 1 };

/** Size steps for the press depth (fraction of the size the control shrinks). */
export type PressSize = 'sm' | 'md' | 'lg';

/** Wider than this (px) counts as a wide control and presses a little less. */
const WIDE = 240;
const DEPTH: Record<PressSize, number> = { sm: 0.03, md: 0.025, lg: 0.02 };
const DEPTH_WIDE: Record<PressSize, number> = {
  sm: 0.025,
  md: 0.02,
  lg: 0.015,
};

/**
 * How far a control shrinks: about 3% for small and icon controls, 2.5% for
 * medium, 2% for large, and a notch less for a wide one (it moves more pixels
 * for the same percentage).
 */
export const pressDepth = (size: PressSize, width: number): number =>
  (width >= WIDE ? DEPTH_WIDE : DEPTH)[size];

/** Tiny cards press the least: the whole card is a big target. */
export const CARD_DEPTH = 0.01;

/** Wrap dense table or data rows in this to keep every control in them still. */
const STILL = '[data-prism-still]';

/** A key press shows for at least this long (ms), however quick the tap. */
const KEY_HOLD = 90;

export interface PressScaleOptions {
  /** The element that scales. No element, no press. */
  target: () => HTMLElement | null | undefined;
  /** The fraction it shrinks at full press. */
  depth: () => number;
  /** False while disabled. */
  enabled?: () => boolean;
  /** Narrows which events count (for example, not a nested control's). */
  accept?: (event: Event) => boolean;
  /** Forward a click that ends on the control's edge (not for a stretched link). Default true. */
  rim?: boolean;
  /** Mark the target `data-pressed` while held, so the state layer shows the press colour. */
  mark?: boolean;
}

export class PressScale implements ReactiveController {
  readonly #press: Press;
  readonly #motion: SpringMotion<'q', 'el'>;
  /** The pointer went down on the target: a click on its edge is still its click. */
  #down = false;
  #upAt = 0;

  constructor(
    private readonly host: ReactiveControllerHost & HTMLElement,
    private readonly o: PressScaleOptions,
  ) {
    host.addController(this);
    this.#press = new Press(
      host,
      () => this.#enabled(),
      () => this.#retarget(),
      { enter: true, keyHold: KEY_HOLD },
    );
    this.#motion = new SpringMotion<'q', 'el'>(
      ['q'],
      { el: { el: () => this.o.target() } },
      (pose) => ({ el: { scale: String(this.#scale(pose.q)) } }),
    );
  }

  get held(): boolean {
    return this.#press.held;
  }

  hostConnected(): void {
    const h = this.host;
    h.addEventListener('pointerdown', this.#onDown);
    h.addEventListener('keydown', this.#onKey);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
      h.addEventListener(type, this.#onUp);
    h.addEventListener('keyup', this.#onUp);
    h.addEventListener('focusout', this.#onUp);
    h.addEventListener('click', this.#onClick, { capture: true });
  }

  hostDisconnected(): void {
    const h = this.host;
    h.removeEventListener('pointerdown', this.#onDown);
    h.removeEventListener('keydown', this.#onKey);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
      h.removeEventListener(type, this.#onUp);
    h.removeEventListener('keyup', this.#onUp);
    h.removeEventListener('focusout', this.#onUp);
    h.removeEventListener('click', this.#onClick, { capture: true });
    this.#press.clear();
    this.#motion.stop();
    this.#show(0);
  }

  hostUpdated(): void {
    // Disabled while held: let go at once.
    if (this.#press.held && !this.#enabled()) {
      this.#press.clear();
      this.#retarget();
    }
    // The first press has to start from a pose, or it would only snap.
    if (!this.#motion.target) this.#motion.snap({ q: 0 });
  }

  #enabled(): boolean {
    return (
      !!this.o.target() &&
      (this.o.enabled?.() ?? true) &&
      // Dense table and data rows opt out: the press colour alone.
      !this.host.closest(STILL)
    );
  }

  #scale(q: number): number {
    return 1 - this.o.depth() * q;
  }

  /** What the stylesheet cannot draw: the held pose, once the move has settled. */
  #show(q: number): void {
    const el = this.o.target();
    if (!el) return;
    const moving = q !== 0 && canAnimate(this.host, el);
    el.style.scale = moving ? String(this.#scale(q)) : '';
    if (this.o.mark) el.toggleAttribute('data-pressed', q !== 0);
  }

  #retarget(): void {
    const q = this.#press.held ? 1 : 0;
    const el = this.o.target();
    if (this.o.mark) el?.toggleAttribute('data-pressed', q !== 0);
    if (!canAnimate(this.host, el ?? null)) {
      this.#motion.snap({ q });
      return this.#show(q);
    }
    this.#motion.go(
      { q },
      () => (q > 0 ? PRESS_IN : PRESS_OUT),
      () => this.#show(q),
    );
  }

  readonly #counts = (e: Event): boolean =>
    (this.o.accept?.(e) ?? true) &&
    e.composedPath().includes(this.o.target() as EventTarget);

  readonly #onDown = (e: PointerEvent): void => {
    if (!this.#counts(e)) return;
    this.#down = e.button === 0;
    this.#press.down(e);
  };

  readonly #onKey = (e: KeyboardEvent): void => {
    if (this.#counts(e)) this.#press.down(e);
  };

  readonly #onUp = (e: Event): void => {
    if (e.type === 'pointerup') this.#upAt = performance.now();
    else if (e.type === 'pointercancel' || e.type === 'pointerleave')
      this.#down = false;
    this.#press.up();
  };

  /**
   * The pressed control is a hair smaller than its box, so a press that ends on
   * its very edge lands on the host. That click is still the control's.
   */
  readonly #onClick = (e: MouseEvent): void => {
    const down = this.#down && performance.now() - this.#upAt < 100;
    this.#down = false;
    const target = this.o.target();
    if (!down || !target || !(this.o.rim ?? true)) return;
    if (e.composedPath()[0] !== this.host) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    target.click();
  };
}

/** Adds press scaling to `host`; the controller registers itself and lives as long as the host. */
export function pressScale(
  host: ReactiveControllerHost & HTMLElement,
  options: PressScaleOptions,
): void {
  new PressScale(host, options);
}
