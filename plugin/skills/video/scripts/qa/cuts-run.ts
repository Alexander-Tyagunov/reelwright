/**
 * @fileoverview Reads a rendered film and measures its cuts: finds where the
 * cuts are from the spec, then reads brightness and loudness from the video.
 */
import {filmTimeline} from '../core/film-timeline.ts';
import type {FilmSpec} from '../shared/contract.ts';
import {frameBrightness} from '../video/brightness.ts';
import {momentaryLoudness} from '../video/momentary.ts';
import type {CutPoint, CutReport} from './cuts.ts';
import {frameAfterCut, measureCut} from './cuts.ts';

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

/** Reads the two frames around a cut by seeking, not by decoding the film. */
async function frameMeans(
  video: string,
  frame: number,
  fps: number,
): Promise<[number, number]> {
  const from = Math.max(frame - 1.5, 0) / fps;
  const {whole} = await frameBrightness([
    '-ss',
    from.toFixed(4),
    '-i',
    video,
    '-frames:v',
    '2',
    '-fps_mode',
    'passthrough',
  ]);
  return [whole[0] ?? 0, whole[1] ?? whole[0] ?? 0];
}

/**
 * Measures every cut of a rendered film. Only the frames next to each cut
 * are decoded, so the memory used does not grow with the film's length.
 *
 * @param video Path of the rendered video.
 * @throws UserError when ffmpeg cannot read the video or its audio.
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
  const loudness = await momentaryLoudness(video);
  const reports: CutReport[] = [];
  for (const cut of cuts) {
    const [before, after] = await frameMeans(
      video,
      frameAfterCut(cut, fps),
      fps,
    );
    reports.push(measureCut(cut, before, after, loudness));
  }
  return reports;
}
