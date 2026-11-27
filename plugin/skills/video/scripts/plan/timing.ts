/**
 * @fileoverview Pose arithmetic and reading time. A pose is one frame of a
 * plate, counted from 1 inside its shot: pose `p` is shown from `(p-1)/rate`
 * to `p/rate` seconds of the shot. All times are in seconds.
 */
import type {PlanLabel, PlanShot, ShotPlan} from './types.ts';

/** Seconds of reading time added per word. */
export const WORD_S = 0.3;

/** Seconds of reading time added once per label. */
export const BASE_S = 0.5;

/** Seconds a label takes to settle after it appears. */
export const ENTRANCE_S = 0.35;

/** Labels on screen at once above which a plan fails. */
export const MAX_LABELS_AT_ONCE = 4;

/** Rounds to 4 decimal places, the precision of a spec's times. */
export function r4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/** Counts the words of the given parts; empty parts count none. */
export function words(...parts: Array<string | undefined>): number {
  return parts.reduce(
    (n, p) => n + (p ? p.split(/\s+/).filter(Boolean).length : 0),
    0,
  );
}

/** Seconds a reader needs for a label with its sub text and line. */
export function readingNeed(label: PlanLabel): number {
  return words(label.text, label.sub, label.line) * WORD_S + BASE_S;
}

/** Seconds a label is on screen: from its first to the end of its last pose. */
export function onScreen(label: PlanLabel, rate: number): number {
  return (label.to_pose - label.from_pose + 1) / rate;
}

/** Seconds from the start of the shot at which a pose begins. */
export function poseStart(pose: number, rate: number): number {
  return (pose - 1) / rate;
}

/** Length of a shot in seconds. */
export function shotSeconds(shot: PlanShot, rate: number): number {
  return shot.poses / rate;
}

/** Film time at which each shot starts, by shot id, in plan order. */
export function shotStarts(
  plan: ShotPlan,
  shots: readonly PlanShot[],
): Map<string, number> {
  const starts = new Map<string, number>();
  let t = 0;
  for (const s of shots) {
    starts.set(s.id, t);
    t += shotSeconds(s, plan.fps_poses);
  }
  return starts;
}
