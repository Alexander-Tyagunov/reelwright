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
  PLATE_EDGE_BLACK,
  PLATE_EDGE_STEP,
  PLATE_RUN_MAX,
  PLATE_SETTLED_SPREAD,
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
  /**
   * `start` or `end` when the run touches the first or last frame and was
   * compared with the one neighbour it has; absent otherwise.
   */
  edge?: 'start' | 'end';
}

function outside(
  run: readonly number[],
  lo: number,
  hi: number,
  step = PLATE_BRIGHTNESS_STEP,
): 'below' | 'above' | null {
  const low = (v: number) =>
    lo - v >= PLATE_BRIGHTNESS_FLOOR && v < lo * (1 - step);
  const high = (v: number) =>
    v - hi >= PLATE_BRIGHTNESS_FLOOR && v > hi * (1 + step);
  if (run.every(low)) {
    return 'below';
  }
  return run.every(high) ? 'above' : null;
}

/** Tells whether two levels differ by at most `spread` of the larger. */
function agree(a: number, b: number, spread: number): boolean {
  return Math.min(a, b) >= Math.max(a, b) * (1 - spread);
}

/** Finds the shortest run that starts at `i` inside the plate. */
function innerRunAt(means: readonly number[], i: number): BrightnessRun | null {
  const before = means[i - 1];
  for (let n = 1; before !== undefined && n <= PLATE_RUN_MAX; n++) {
    const after = means[i + n];
    if (after === undefined) {
      return null;
    }
    const [lo, hi] = [Math.min(before, after), Math.max(before, after)];
    const run = means.slice(i, i + n);
    if (agree(lo, hi, PLATE_ANCHOR_SPREAD) && outside(run, lo, hi)) {
      const mean = run.reduce((a, b) => a + b, 0) / n;
      return {first: i, last: i + n - 1, mean, around: [before, after]};
    }
  }
  return null;
}

/**
 * Finds a run that touches an end of the plate. It has one good neighbour,
 * so the rule is stricter than inside the plate: the neighbour must be
 * settled (the frame beyond it agrees), the run must be flat, and it must
 * lie below {@link PLATE_EDGE_STEP} of the neighbour and be near black
 * ({@link PLATE_EDGE_BLACK}). Only a dark run counts, because a lost
 * foreground renders black and a lamp that goes out on purpose does not. A fade in from black
 * or a ramp up is neither flat nor settled and is not reported.
 */
function edgeRun(
  means: readonly number[],
  edge: 'start' | 'end',
): BrightnessRun | null {
  const last = means.length - 1;
  const atStart = edge === 'start';
  for (let n = 1; n <= PLATE_RUN_MAX && n < last; n++) {
    const first = atStart ? 0 : last + 1 - n;
    const run = means.slice(first, first + n);
    const anchor = means[atStart ? n : first - 1] as number;
    const next = means[atStart ? n + 1 : first - 2] as number;
    const flat = agree(Math.min(...run), Math.max(...run), PLATE_ANCHOR_SPREAD);
    const settled = agree(anchor, next, PLATE_SETTLED_SPREAD);
    const black = Math.max(...run) <= PLATE_EDGE_BLACK;
    const low = outside(run, anchor, anchor, PLATE_EDGE_STEP) === 'below';
    if (settled && black && low && (flat || n === 1)) {
      const mean = run.reduce((a, b) => a + b, 0) / n;
      return {
        first,
        last: first + n - 1,
        mean,
        around: [anchor, anchor] as [number, number],
        edge,
      };
    }
  }
  return null;
}

/**
 * Finds the runs of a series that lie outside the range of the two frames
 * next to them by more than {@link PLATE_BRIGHTNESS_STEP} of the nearer
 * edge and at least {@link PLATE_BRIGHTNESS_FLOOR} grey levels. A run is at
 * most {@link PLATE_RUN_MAX} frames long and has a good frame on both sides
 * (inside the plate) whose levels agree within {@link PLATE_ANCHOR_SPREAD}, so a step to a new
 * level, such as a lamp switched off, is not a run. A run that touches the
 * first or last frame has only one neighbour and is compared with that one
 * (`edge` says which end), so a render that lost its last frames is found.
 * A steady fade is never a run, because each of
 * its frames lies between its neighbours.
 *
 * @param means Mean grey level of each frame, in frame order.
 */
export function findBrightnessRuns(means: readonly number[]): BrightnessRun[] {
  const found: BrightnessRun[] = [];
  const start = edgeRun(means, 'start');
  if (start) {
    found.push(start);
  }
  let i = start ? start.last + 1 : 1;
  while (i < means.length) {
    const hit = innerRunAt(means, i);
    if (hit) {
      found.push(hit);
    }
    i = hit ? hit.last + 1 : i + 1;
  }
  const end = edgeRun(means, 'end');
  if (end && !found.some(r => r.last >= end.first)) {
    found.push(end);
  }
  return found;
}
