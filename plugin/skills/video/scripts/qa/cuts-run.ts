/**
 * @fileoverview Reads a rendered film and measures its cuts: finds where the
 * cuts are from the spec, then reads brightness and loudness from the video.
 */
import {filmTimeline} from '../core/film-timeline.ts';
import type {FilmSpec} from '../shared/contract.ts';
import {frameBrightness} from '../video/brightness.ts';
import {momentaryLoudness} from '../video/momentary.ts';
import type {CutPoint, CutReport} from './cuts.ts';
import {analyseCuts} from './cuts.ts';

function nameOf(film: FilmSpec, index: number): string {
  const scene = film.scenes[index];
  return scene?.id || `scene ${index + 1} (${scene?.type})`;
}

/**
 * Lists the cuts of a film: one between each pair of neighbouring scenes.
 * With a fade the cut time is the middle of the overlap.
 *
 * @returns Cuts in film order; empty for a film of one scene.
 * @throws UserError when the scene durations are not valid.
 */
export function cutPoints(film: FilmSpec): CutPoint[] {
  const {slots} = filmTimeline(film);
  return slots.slice(1).map(slot => ({
    scene: slot.index,
    from: nameOf(film, slot.index - 1),
    to: nameOf(film, slot.index),
    at: slot.start + slot.tin / 2,
  }));
}

/**
 * Measures every cut of a rendered film.
 *
 * @param video Path of the rendered video.
 * @throws UserError when ffmpeg cannot read the video.
 */
export async function measureCuts(
  film: FilmSpec,
  video: string,
): Promise<CutReport[]> {
  const cuts = cutPoints(film);
  if (!cuts.length) {
    return [];
  }
  const fps = film.meta?.fps ?? 30;
  const {whole} = await frameBrightness(['-i', video]);
  const loudness = await momentaryLoudness(video);
  return analyseCuts(cuts, whole, fps, loudness);
}
