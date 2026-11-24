/**
 * @fileoverview Small numeric helpers used by every part of the runtime.
 * All functions are pure. Time values are in seconds.
 */

/**
 * Limits `x` to the range from `a` to `b`.
 * @param x Value to limit.
 * @param a Lower bound. Default 0.
 * @param b Upper bound. Default 1.
 */
export function clamp(x: number, a = 0, b = 1): number {
  return Math.min(b, Math.max(a, x));
}

/**
 * Linear interpolation.
 * @param a Value at `p` = 0.
 * @param b Value at `p` = 1.
 * @param p Progress, normally from 0 to 1.
 */
export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

/**
 * Progress of a time window, from 0 to 1.
 * @param t Current time, in seconds.
 * @param at Start of the window, in seconds.
 * @param dur Length of the window, in seconds. A window of 0 or less is a
 *   step: 0 before `at`, 1 from `at` on.
 */
export function prog(t: number, at: number, dur: number): number {
  if (dur <= 0) {
    return t >= at ? 1 : 0;
  }
  return clamp((t - at) / dur);
}

/** Rounds to 3 decimal places. Used for style values and published times. */
export function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
