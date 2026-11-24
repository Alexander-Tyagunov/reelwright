/**
 * @fileoverview Pure analysis of the motion signal. The signal is an array of
 * per-frame differences: `diffs[k]` is the mean absolute difference, in grey
 * levels, between frame `k - 1` and frame `k`. `diffs[0]` is unused. Times
 * are in seconds, ranges are in frame numbers.
 */
import {r3} from './labels.ts';
import {
  ABRUPT_DIFF,
  BOUNDARY_S,
  DEAD_DIFF,
  DEAD_WINDOW_S,
  FREEZE_BRIDGE_DIFF,
  FREEZE_DIFF,
  FREEZE_MIN_S,
  HOLD_MARGIN_S,
  SEAM_ADD,
  SEAM_FACTOR,
} from './thresholds.ts';

/** A run of unchanged frames. Frame numbers. */
export interface StillRun {
  /** Last changing frame before the run. */
  from: number;
  /** Last unchanged frame of the run. */
  to: number;
  /** Number of unchanged frames. */
  length: number;
}

/** A still stretch long enough to report. Times in seconds. */
export interface Freeze {
  start: number;
  end: number;
  seconds: number;
}

/** A scene that shows no motion at its start. */
export interface DeadScene {
  index: number;
  /** Largest frame difference seen in the window, in grey levels. */
  maxDiff: number;
  /** Window start, in seconds. */
  from: number;
  /** Window end, in seconds. */
  to: number;
}

/** What a motion check needs to know about one scene. */
export interface SceneSpan {
  index: number;
  /** Start in seconds. May be negative for a first scene with a lead. */
  start: number;
  /** Length in seconds. */
  duration: number;
}

/**
 * Marks each frame as unchanged or not. A single frame under 0.1 grey levels
 * that sits between two unchanged frames counts as unchanged, because video
 * keyframe refreshes put such spikes inside a still stretch.
 */
export function stillMask(diffs: readonly number[]): boolean[] {
  const still = diffs.map((v, i) => i > 0 && v < FREEZE_DIFF);
  for (let i = 2; i < diffs.length - 1; i++) {
    const v = diffs[i] ?? Number.POSITIVE_INFINITY;
    if (!still[i] && v < FREEZE_BRIDGE_DIFF && still[i - 1] && still[i + 1]) {
      still[i] = true;
    }
  }
  return still;
}

/** Collects runs of consecutive unchanged frames from a mask. */
export function stillRuns(still: readonly boolean[]): StillRun[] {
  const runs: StillRun[] = [];
  let k = 1;
  while (k < still.length) {
    if (!still[k]) {
      k++;
      continue;
    }
    let end = k;
    while (still[end + 1]) {
      end++;
    }
    runs.push({from: k - 1, to: end, length: end - k + 1});
    k = end + 1;
  }
  return runs;
}

/**
 * Keeps the runs that last at least 0.5 s and converts them to seconds.
 *
 * @param fps Frames per second of the video.
 */
export function toFreezes(runs: readonly StillRun[], fps: number): Freeze[] {
  return runs
    .filter(run => run.length / fps >= FREEZE_MIN_S - 1e-9)
    .map(run => ({
      start: r3(run.from / fps),
      end: r3(run.to / fps),
      seconds: r3(run.length / fps),
    }));
}

/**
 * Longest still stretch a scene may have: the film's `maxHold`, or the
 * scene's longest reading time plus 1.5 s, whichever is larger. Text must
 * stay still while it is read.
 *
 * @param maxHold Seconds from the spec.
 * @param need Longest reading time of the scene's texts, in seconds.
 * @returns Seconds, rounded to 2 decimals.
 */
export function freezeLimit(maxHold: number, need: number): number {
  return Math.round(Math.max(maxHold, need + HOLD_MARGIN_S) * 100) / 100;
}

/**
 * Finds scenes whose first 1.5 s never change by more than 0.1 grey levels.
 *
 * @param scenes Scene starts and lengths.
 * @param fps Frames per second of the video.
 */
export function deadScenes(
  diffs: readonly number[],
  scenes: readonly SceneSpan[],
  fps: number,
): DeadScene[] {
  const dead: DeadScene[] = [];
  for (const scene of scenes) {
    const window = Math.min(DEAD_WINDOW_S, scene.duration);
    const first = Math.max(1, Math.floor(scene.start * fps));
    const last = Math.min(
      diffs.length - 1,
      Math.ceil((scene.start + window) * fps),
    );
    let maxDiff = 0;
    for (let i = first; i <= last; i++) {
      maxDiff = Math.max(maxDiff, diffs[i] ?? 0);
    }
    if (!(maxDiff > DEAD_DIFF)) {
      dead.push({
        index: scene.index,
        maxDiff,
        from: scene.start,
        to: scene.start + window,
      });
    }
  }
  return dead;
}

/**
 * Finds frames that jump by more than 35 grey levels with no scene boundary
 * within 0.15 s.
 *
 * @param boundaries Scene start and end times, in seconds.
 * @returns Frame numbers.
 */
export function abruptFrames(
  diffs: readonly number[],
  fps: number,
  boundaries: readonly number[],
): number[] {
  const found: number[] = [];
  for (let i = 1; i < diffs.length; i++) {
    const big = (diffs[i] ?? 0) > ABRUPT_DIFF;
    const near = boundaries.some(
      b => Math.abs(i / fps - b) <= BOUNDARY_S + 1e-9,
    );
    if (big && !near) {
      found.push(i);
    }
  }
  return found;
}

/** Median of a list. 0 for an empty list. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (!sorted.length) {
    return 0;
  }
  return sorted.length % 2
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Largest difference the last frame may have from the first frame of a loop:
 * 1.5 times the median motion outside still stretches, plus 0.05 grey levels.
 *
 * @returns The median motion and the limit, both in grey levels.
 */
export function seamLimit(
  diffs: readonly number[],
  runs: readonly StillRun[],
): {median: number; limit: number} {
  const still = new Set<number>();
  for (const run of runs) {
    for (let i = run.from + 1; i <= run.to; i++) {
      still.add(i);
    }
  }
  const moving = diffs.filter((_, i) => i > 0 && !still.has(i));
  const mid = median(moving);
  return {median: mid, limit: SEAM_FACTOR * mid + SEAM_ADD};
}
