import type { Pose, Tune } from './spring-motion.js';
import { clamp, num } from './choice-motion.js';

/**
 * Private. Motion shared by the text fields. Each export is a pose, how that
 * pose looks, and how it moves; the field owns the driver (see
 * `spring-motion.ts`). Transform and opacity only.
 */

/** Label pose: 0 rests in the field like a placeholder, 1 sits on the top edge. */
export type LabelPose = Pose<'l'>;
/** The floated label is this much smaller (12px from 14px). */
const LABEL_SCALE = 0.143;

/** A little bounce, so the label settles on the edge instead of stopping at it. */
export const LABEL_TUNE: Tune = { w: 34, z: 0.8 };

/** Rest and moving looks of the floating label and its backing patch. */
export const labelLook = ({ l }: LabelPose) => ({
  transform: `translateY(calc(var(--_prism-control-height) * ${num(-0.5 * l)})) scale(${num(1 - LABEL_SCALE * l)})`,
  patch: clamp(l),
});

/** Nudge pose: sideways travel of the field, in units of `NUDGE_PX`. */
export type NudgePose = Pose<'n'>;
const NUDGE_PX = 5;
export const nudgeLook = ({ n }: NudgePose): string =>
  `translateX(${num(n * NUDGE_PX)}px)`;
/** Starts from rest with a push and rings out in about two swings. */
export const NUDGE_TUNE: Tune = { w: 46, z: 0.3, kick: 42 };

/** Pop pose for something that appears (the clear button): 0 hidden, 1 shown. */
export type PopPose = Pose<'s'>;
export const popLook = ({ s }: PopPose) => ({
  transform: `scale(${num(0.6 + 0.4 * s)})`,
  opacity: num(clamp(s)),
});
export const POP_TUNE: Tune = { w: 38, z: 0.7 };

/** Check pose: 0 not drawn, 1 drawn. The pop can overshoot 1; the stroke cannot. */
export type CheckPose = Pose<'c'>;
export const checkLook = ({ c }: CheckPose) => ({
  mark: {
    strokeDashoffset: num(1 - clamp(c)),
    opacity: num(clamp(c * 6)),
  },
  box: { transform: `scale(${num(0.7 + 0.3 * c)})` },
});
export const CHECK_ON_TUNE: Tune = { w: 30, z: 0.62 };
export const CHECK_OFF_TUNE: Tune = { w: 40, z: 1 };
