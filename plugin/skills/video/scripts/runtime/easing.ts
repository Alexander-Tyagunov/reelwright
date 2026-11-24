/**
 * @fileoverview Easing curves. An ease maps progress (0 to 1) to a shaped
 * progress (usually 0 to 1; `pop` overshoots above 1 on purpose).
 */

import {clamp} from './math.ts';

/** A function from linear progress (0 to 1) to eased progress. */
export type EaseFn = (x: number) => number;

/** Names of the built-in curves. */
export type EaseName = 'linear' | 'out' | 'in' | 'inOut' | 'pop';

const MAX_STEPS = 40;
const TOLERANCE = 1e-7;

/**
 * Builds a CSS-style cubic Bezier ease from two control points.
 * The result is 0 at or below 0 and 1 at or above 1.
 * @param x1 X of the first control point, 0 to 1.
 * @param y1 Y of the first control point.
 * @param x2 X of the second control point, 0 to 1.
 * @param y2 Y of the second control point.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EaseFn {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const fx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const fy = (s: number) => ((ay * s + by) * s + cy) * s;
  return x => {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }
    let lo = 0;
    let hi = 1;
    let s = x;
    // Bisection always converges because x(s) is monotonic.
    for (let i = 0; i < MAX_STEPS; i++) {
      const e = fx(s) - x;
      if (Math.abs(e) < TOLERANCE) {
        break;
      }
      if (e > 0) {
        hi = s;
      } else {
        lo = s;
      }
      s = (lo + hi) / 2;
    }
    return fy(s);
  };
}

/**
 * The named curves.
 * - `linear`: no shaping.
 * - `out`: fast start, long soft stop. Use for entrances.
 * - `in`: slow start, fast end. Use for exits.
 * - `inOut`: use for moves between two on-screen states.
 * - `pop`: small overshoot past 1 before it settles.
 */
export const ease: Readonly<Record<EaseName, EaseFn>> = {
  linear: x => clamp(x),
  out: cubicBezier(0.16, 1, 0.3, 1),
  in: cubicBezier(0.7, 0, 0.84, 0),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  pop: cubicBezier(0.34, 1.56, 0.64, 1),
};
