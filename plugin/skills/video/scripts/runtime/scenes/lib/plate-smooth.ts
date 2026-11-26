/**
 * @fileoverview Smoothing and vertical extremes of a tracked point, for
 * labels that glide while their leader line follows the exact point. Pure:
 * no DOM. Positions are plate fractions; times are seconds.
 */

import type {PlatePoint} from '../../../shared/plate.ts';

/** A smoothed track: one x and one y per plate frame. */
export interface Smoothed {
  x: number[];
  y: number[];
}

/** Reads index `i` of a run `[a, b]`, mirrored through its ends as a point. */
function reach(v: readonly number[], a: number, b: number, i: number): number {
  if ((i >= a && i <= b) || a === b) {
    return v[a === b ? a : i] ?? 0;
  }
  const end = i < a ? a : b;
  // An odd mirror keeps a straight path straight, so the ends do not lag.
  return 2 * (v[end] ?? 0) - reach(v, a, b, 2 * end - i);
}

function smoothRun(
  v: readonly number[],
  a: number,
  b: number,
  sigma: number,
  out: number[],
): void {
  const radius = Math.ceil(3 * sigma);
  const weights = Array.from({length: 2 * radius + 1}, (_, k) =>
    Math.exp(-0.5 * ((k - radius) / sigma) ** 2),
  );
  const total = weights.reduce((s, w) => s + w, 0);
  for (let i = a; i <= b; i++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      sum += (weights[k + radius] ?? 0) * reach(v, a, b, i + k);
    }
    out[i] = sum / total;
  }
}

/** Calls `fn` with the first and last frame of each run of visible frames. */
function eachRun(
  visible: readonly number[],
  fn: (a: number, b: number) => void,
): void {
  let a = -1;
  for (let f = 0; f <= visible.length; f++) {
    const on = f < visible.length && (visible[f] ?? 0) > 0;
    if (on && a < 0) {
      a = f;
    } else if (!on && a >= 0) {
      fn(a, f - 1);
      a = -1;
    }
  }
}

/**
 * Low-passes a track with a zero-phase Gaussian window.
 *
 * @param point The exported point.
 * @param fps Plate frames per second.
 * @param seconds Standard deviation of the window in seconds. 0 or less
 *   returns the track unchanged.
 * @returns A copy with one value per frame. Each run of visible frames is
 *   smoothed alone, so a gap never smears one side into the other, and a run
 *   is mirrored through its ends so they do not lag. Frames where the point
 *   is not visible keep their exported values.
 */
export function smoothTrack(
  point: PlatePoint,
  fps: number,
  seconds: number,
): Smoothed {
  const x = [...point.x];
  const y = [...point.y];
  const sigma = seconds * fps;
  if (!(sigma > 0)) {
    return {x, y};
  }
  eachRun(point.visible, (a, b) => {
    smoothRun(point.x, a, b, sigma, x);
    smoothRun(point.y, a, b, sigma, y);
  });
  return {x, y};
}

/**
 * Finds the highest and lowest place of a point while it is visible.
 *
 * @param f0 First plate frame to look at.
 * @param f1 Last plate frame to look at.
 * @returns `top` is the smallest y (highest on screen), `bottom` the largest,
 *   as plate fractions. Falls back to the point at `f0` when it is never
 *   visible in the range.
 */
export function verticalExtent(
  point: PlatePoint,
  f0: number,
  f1: number,
): {top: number; bottom: number} {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (let f = f0; f <= f1; f++) {
    if ((point.visible[f] ?? 0) > 0) {
      top = Math.min(top, point.y[f] ?? 0);
      bottom = Math.max(bottom, point.y[f] ?? 0);
    }
  }
  if (top > bottom) {
    return {top: point.y[f0] ?? 0, bottom: point.y[f0] ?? 0};
  }
  return {top, bottom};
}
