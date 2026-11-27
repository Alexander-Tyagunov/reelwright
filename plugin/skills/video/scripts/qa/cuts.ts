/**
 * @fileoverview The numbers behind `reel cuts` and the `cuts` gate: for each
 * cut between two scenes, the brightness of the last frame before and the
 * first frame after, and the jump in momentary loudness. The functions are
 * pure; the callers read the video.
 */
import type {MomentaryPoint} from '../video/momentary.ts';
import {
  CUT_BRIGHTNESS_JUMP,
  CUT_LOUDNESS_AFTER_S,
  CUT_LOUDNESS_BEFORE_S,
  CUT_LOUDNESS_GAP_S,
  CUT_LOUDNESS_JUMP_LU,
} from './thresholds.ts';

/** Where a cut lies in the film. */
export interface CutPoint {
  /** Index of the scene after the cut, counted from 0. */
  scene: number;
  /** Name of the scene before the cut. */
  from: string;
  /** Name of the scene after the cut. */
  to: string;
  /** Film time of the cut in seconds: for a fade, the middle of it. */
  at: number;
}

/** What was measured at one cut. */
export interface CutReport extends CutPoint {
  /** Mean grey level (0 to 255) of the last frame before the cut. */
  before: number;
  /** Mean grey level (0 to 255) of the first frame after the cut. */
  after: number;
  /** Change of brightness as a fraction of the brighter frame, 0 to 1. */
  change: number;
  /** Mean loudness in the second before the cut, in LUFS, or null. */
  loudBefore: number | null;
  /** Highest loudness in the second after the cut, in LUFS, or null. */
  loudAfter: number | null;
  /** Rise from `loudBefore` to `loudAfter` in LU, or null. */
  jump: number | null;
  /** What is notable, one sentence each; empty when the cut is calm. */
  flags: string[];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Loudness just before and just after a cut time, from the readings. */
export function loudnessAround(
  points: readonly MomentaryPoint[],
  at: number,
): {before: number; after: number} | null {
  const before = points
    .filter(
      p => p.t >= at - CUT_LOUDNESS_BEFORE_S && p.t < at - CUT_LOUDNESS_GAP_S,
    )
    .map(p => p.lufs);
  const after = points
    .filter(p => p.t >= at && p.t <= at + CUT_LOUDNESS_AFTER_S)
    .map(p => p.lufs);
  if (!before.length || !after.length) {
    return null;
  }
  return {before: mean(before), after: Math.max(...after)};
}

function flagsOf(change: number, jump: number | null): string[] {
  const flags: string[] = [];
  if (change > CUT_BRIGHTNESS_JUMP) {
    const pct = Math.round(change * 100);
    flags.push(`brightness changes by ${pct}% across the cut`);
  }
  if (jump !== null && jump > CUT_LOUDNESS_JUMP_LU) {
    flags.push(`loudness rises by ${jump.toFixed(1)} LU across the cut`);
  }
  return flags;
}

/**
 * Index of the first frame after a cut, in a film of `fps` frames a second.
 * The frame before it is the one before the cut.
 */
export function frameAfterCut(cut: CutPoint, fps: number): number {
  return Math.max(Math.round(cut.at * fps), 1);
}

/**
 * Measures one cut.
 *
 * @param before Mean grey level (0 to 255) of the last frame before the cut.
 * @param after Mean grey level (0 to 255) of the first frame after it.
 * @param loudness Momentary loudness readings, empty for a silent video.
 */
export function measureCut(
  cut: CutPoint,
  before: number,
  after: number,
  loudness: readonly MomentaryPoint[],
): CutReport {
  const peak = Math.max(before, after, 1e-6);
  const change = Math.abs(after - before) / peak;
  const loud = loudnessAround(loudness, cut.at);
  const jump = loud ? loud.after - loud.before : null;
  return {
    ...cut,
    before,
    after,
    change,
    loudBefore: loud?.before ?? null,
    loudAfter: loud?.after ?? null,
    jump,
    flags: flagsOf(change, jump),
  };
}

/**
 * Measures every cut from the brightness of every frame.
 *
 * @param cuts Where the cuts are.
 * @param means Mean grey level of every frame of the video, in order.
 * @param fps Frames per second of the video.
 * @param loudness Momentary loudness readings, empty for a silent video.
 */
export function analyseCuts(
  cuts: readonly CutPoint[],
  means: readonly number[],
  fps: number,
  loudness: readonly MomentaryPoint[],
): CutReport[] {
  const last = means.length - 1;
  return cuts.map(cut => {
    const frame = Math.min(frameAfterCut(cut, fps), last);
    return measureCut(cut, means[frame - 1] ?? 0, means[frame] ?? 0, loudness);
  });
}
