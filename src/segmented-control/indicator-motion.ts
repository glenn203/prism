import { clamp, num } from '../internal/choice-motion.js';
import type { Pose, Tune } from '../internal/spring-motion.js';

/**
 * Private. The indicator of a segmented control is one rounded shape. Its left
 * edge `l` and right edge `r` (px from the track's inner left) are two springs,
 * so it stretches as it travels: the edge that leads the way is quick and
 * bouncy, the one that follows is softer, and the shape pulls itself together
 * on the new segment. `o` is its opacity (it fades in when the first segment is
 * picked, and never slides in from nowhere). Drawn with transform and opacity
 * only: the element is a fixed `REF` px wide and is scaled to the width it needs.
 */
export type IndicatorPose = Pose<'l' | 'r' | 'o'>;

/** The indicator's own width in CSS (px); `scaleX` stretches it to the segment. */
export const REF = 100;

/** Where the shape may be drawn: the track's inner edges. The bounce never leaves them. */
export interface Bounds {
  min: number;
  max: number;
}

export const indicatorLook = (
  { l, r, o }: IndicatorPose,
  { min, max }: Bounds,
): Keyframe => {
  const left = clamp(l, min, max - 1);
  const right = clamp(r, left + 1, max);
  return {
    transform: `translateX(${num(left)}px) scaleX(${num((right - left) / REF)})`,
    opacity: num(clamp(o)),
  };
};

/**
 * Ms a move takes with the tunes below as they are. A longer or shorter
 * duration scales their frequencies by this over the duration.
 */
export const NOMINAL_MS = 350;

/** The edge the indicator moves toward: springy. */
export const LEAD: Tune = { w: 44, z: 0.74 };
/** The edge it leaves behind: softer, a little slower, so the shape stretches. */
export const TRAIL: Tune = { w: 34, z: 0.9 };
export const FADE: Tune = { w: 40, z: 1 };
