/**
 * @fileoverview Chooses the moments at which the layout gate looks at a
 * scene. Times are film seconds.
 */
import type {SceneInfo, TextInfo} from '../shared/contract.ts';
import {r3} from './labels.ts';
import {MAX_SAMPLES_PER_SCENE, SETTLE_SAMPLE_OFFSET_S} from './thresholds.ts';

/**
 * Picks the times at which to measure one scene: its rest time (`check`),
 * and 0.05 s after each of its texts has settled, so a label that is visible
 * only in the middle of the scene is measured too. Times are rounded to
 * 3 decimals, kept within the film, and listed once. When more than 6 remain,
 * the rest time stays and the others are spread evenly.
 *
 * @param scene The scene.
 * @param texts Every text of the film. Other scenes' texts are ignored.
 * @param filmDuration Film length in seconds.
 * @returns Film times in seconds, rest time first, then ascending.
 */
export function sampleTimes(
  scene: SceneInfo,
  texts: readonly TextInfo[],
  filmDuration: number,
): number[] {
  const within = (t: number) => r3(Math.min(Math.max(t, 0), filmDuration));
  const rest = within(scene.check);
  const settled = texts
    .filter(t => t.scene === scene.index)
    .map(t => within(scene.start + t.settle + SETTLE_SAMPLE_OFFSET_S));
  const others = [...new Set(settled)]
    .filter(t => t !== rest)
    .sort((a, b) => a - b);
  const room = MAX_SAMPLES_PER_SCENE - 1;
  if (others.length <= room) {
    return [rest, ...others];
  }
  const spread = Array.from({length: room}, (_, i) => {
    return others[Math.round((i * (others.length - 1)) / (room - 1))] ?? rest;
  });
  return [rest, ...new Set(spread)];
}
