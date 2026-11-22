import { hasPolishEffect } from './polish-scope.js';
import type { Tune } from './spring-motion.js';

/**
 * Private. Press motion shared by the checkbox and the radio: the box squishes
 * while held (q = 1) and springs back with a little bounce on release. A pose
 * number `q` below 0 is the stretch of the pop that follows a toggle.
 */
const SQUISH_X = 0.06;
const SQUISH_Y = 0.12;

/** Held down: a short, nearly critical spring. */
export const PRESS: Tune = { w: 30, z: 0.9 };
/** Letting go: the same speed, but bouncy. */
export const RELEASE: Tune = { w: 30, z: 0.5 };
/** Extra push (per second) that makes the box pop when it is turned on or off. */
export const POP_ON = -38;
export const POP_OFF = -24;

export const clamp = (n: number, lo = 0, hi = 1): number =>
  Math.min(hi, Math.max(lo, n));
export const num = (n: number): string => n.toFixed(3);

export const squish = (q: number): Keyframe => ({
  transform: `scale(${num(1 - SQUISH_X * q)}, ${num(1 - SQUISH_Y * q)})`,
});

/** The tune for the squish number: held down or letting go, plus any pop. */
export const squishTune = (held: boolean, pop = 0): Tune => ({
  ...(held ? PRESS : RELEASE),
  kick: pop,
});

/** True when the user asks for no motion. */
export const prefersReducedMotion = (): boolean =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether a move can play now: on screen, motion allowed, animations supported. */
export const canAnimate = (host: Element, box: Element | null): boolean =>
  host.isConnected &&
  !prefersReducedMotion() &&
  typeof box?.animate === 'function';

/** Like `canAnimate`, and only inside a polish scope that includes motion. */
export const canPolishAnimate = (host: Element, box: Element | null): boolean =>
  canAnimate(host, box) && hasPolishEffect(host, 'motion');
