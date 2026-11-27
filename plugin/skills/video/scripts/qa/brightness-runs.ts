/**
 * @fileoverview Finds runs of frames whose brightness leaves the range of
 * the frames on both sides of the run. A render that lost its foreground
 * gives such a run: the frames are much darker, or much lighter, than the
 * good frames before and after, while the picture changes smoothly everywhere
 * else.
 */
import {
  PLATE_ANCHOR_SPREAD,
  PLATE_BRIGHTNESS_FLOOR,
  PLATE_BRIGHTNESS_STEP,
  PLATE_RUN_MAX,
} from './thresholds.ts';

/** A run of frames that stands out from both sides. */
export interface BrightnessRun {
  /** Zero-based index of the first frame of the run. */
  first: number;
  /** Zero-based index of the last frame of the run. */
  last: number;
  /** Mean grey level of the run's frames. */
  mean: number;
  /** Mean grey levels of the frame before and the frame after the run. */
  around: [number, number];
}

function outside(
  run: readonly number[],
  lo: number,
  hi: number,
): 'below' | 'above' | null {
  const low = (v: number) =>
    lo - v >= PLATE_BRIGHTNESS_FLOOR && v < lo * (1 - PLATE_BRIGHTNESS_STEP);
  const high = (v: number) =>
    v - hi >= PLATE_BRIGHTNESS_FLOOR && v > hi * (1 + PLATE_BRIGHTNESS_STEP);
  if (run.every(low)) {
    return 'below';
  }
  return run.every(high) ? 'above' : null;
}

/** Finds the shortest run that starts at `i`, or null when none does. */
function runAt(means: readonly number[], i: number): BrightnessRun | null {
  const before = means[i - 1];
  if (before === undefined) {
    return null;
  }
  for (let n = 1; n <= PLATE_RUN_MAX; n++) {
    const after = means[i + n];
    if (after === undefined) {
      return null;
    }
    const [lo, hi] = [Math.min(before, after), Math.max(before, after)];
    const run = means.slice(i, i + n);
    if (lo >= hi * (1 - PLATE_ANCHOR_SPREAD) && outside(run, lo, hi)) {
      const mean = run.reduce((a, b) => a + b, 0) / n;
      return {first: i, last: i + n - 1, mean, around: [before, after]};
    }
  }
  return null;
}

/**
 * Finds the runs of a series that lie outside the range of the two frames
 * next to them by more than {@link PLATE_BRIGHTNESS_STEP} of the nearer
 * edge and at least {@link PLATE_BRIGHTNESS_FLOOR} grey levels. A run is at
 * most {@link PLATE_RUN_MAX} frames long and has a good frame on both sides
 * whose levels agree within {@link PLATE_ANCHOR_SPREAD}, so a step to a new
 * level, such as a lamp switched off, is not a run. The first and last
 * frames are never reported. A steady fade is never a run, because each of
 * its frames lies between its neighbours.
 *
 * @param means Mean grey level of each frame, in frame order.
 */
export function findBrightnessRuns(means: readonly number[]): BrightnessRun[] {
  const found: BrightnessRun[] = [];
  let i = 0;
  while (i < means.length) {
    const hit = runAt(means, i);
    if (hit) {
      found.push(hit);
    }
    i = hit ? hit.last + 1 : i + 1;
  }
  return found;
}
