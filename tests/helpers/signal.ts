/**
 * @fileoverview Builds synthetic motion signals for the freeze and motion
 * tests. A signal is the array of per-frame differences in grey levels.
 */
import type {DecodedMotion} from '../../plugin/skills/video/scripts/qa/motion-decode.ts';

/** A stretch of frames at one difference level: `[frames, level]`. */
export type Stretch = [frames: number, level: number];

/**
 * Joins stretches into one signal. Index 0 is the unused slot of the first
 * frame, so the signal has one more entry than the stretches have frames.
 */
export function signal(...stretches: Stretch[]): number[] {
  const out = [0];
  for (const [frames, level] of stretches) {
    for (let i = 0; i < frames; i++) {
      out.push(level);
    }
  }
  return out;
}

/** Wraps a signal as the result of decoding a video. */
export function decoded(diffs: number[], seam = 0): DecodedMotion {
  return {diffs, count: diffs.length, seam};
}
