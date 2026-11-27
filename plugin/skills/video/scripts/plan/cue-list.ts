/**
 * @fileoverview Turns the cues of a plan shot, and the extra cues of a plate,
 * into the `cues` of a plate scene.
 */
import {poseStart, r4} from './timing.ts';
import type {PlanCue} from './types.ts';

/** A cue of a scene: `at` is in seconds from the start of the scene. */
export interface SceneCueOut {
  at: number;
  kind: string;
  gain: number;
}

/**
 * Merges cue lists, orders them by pose and converts poses to seconds.
 * Cues on the same pose keep the order they were given in.
 *
 * @param rate Poses per second.
 * @param lists Cue lists, such as the shot's own then the extra cues.
 */
export function cueList(
  rate: number,
  ...lists: ReadonlyArray<readonly PlanCue[]>
): SceneCueOut[] {
  return lists
    .flat()
    .map(c => ({pose: c.pose, kind: c.kind, gain: c.gain}))
    .sort((a, b) => a.pose - b.pose)
    .map(c => ({at: r4(poseStart(c.pose, rate)), kind: c.kind, gain: c.gain}));
}
