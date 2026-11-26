/**
 * @fileoverview Film facts for the sound tests: scenes that overlap by a
 * transition and carry text that settles at known times. Times are seconds.
 */
import type {SceneInfo} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {filmOf, textOf} from './info.ts';

/** Seconds adjacent scenes overlap in {@link soundFilm}. */
export const FIXTURE_OVERLAP = 0.5;

/**
 * A film of `count` scenes of `each` seconds that overlap by
 * {@link FIXTURE_OVERLAP}. Every scene has three texts that settle at
 * scene-local 0.6, 1.2 and 1.25 seconds, so the last one is too close to the
 * one before it to get a tick.
 */
export function soundFilm(count = 10, each = 9.45) {
  const base = filmOf(Array.from({length: count}, () => each));
  const scenes: SceneInfo[] = base.scenes.map((s, i) => {
    const start = i * (each - FIXTURE_OVERLAP);
    return {...s, start, end: start + each};
  });
  const duration = count * each - (count - 1) * FIXTURE_OVERLAP;
  const texts = scenes.flatMap((_s, i) => [
    textOf(i, {settle: 0.6, words: 2}),
    textOf(i, {settle: 1.2, words: 10}),
    textOf(i, {settle: 1.25, words: 4}),
    textOf(i, {settle: 2.0, words: 3, need: 0}),
  ]);
  return {...base, overlap: FIXTURE_OVERLAP, scenes, texts, duration};
}
