/**
 * @fileoverview `cuts`: after a render, reports the brightness and the
 * loudness on both sides of every cut. It reports; it never fails a film.
 */
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Args} from '../core/args.ts';
import {stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {outputsOf} from '../core/outputs.ts';
import {loadSpec} from '../core/spec.ts';
import {formatCuts} from '../qa/cuts-format.ts';
import {measureCuts} from '../qa/cuts-run.ts';

/**
 * Prints one row per cut: the mean brightness of the last frame before and
 * the first after, and the rise in momentary loudness. A cut whose
 * brightness changes by more than 50% of the brighter frame, or whose
 * loudness rises by more than 6 LU, is listed as a warning.
 *
 * @param args `cuts film.json [--video out/film.mp4] [--json]`.
 * @returns 0 always, once the video was read.
 * @throws UserError when the spec or the video is missing.
 */
export async function run(args: Args): Promise<number> {
  const spec = loadSpec(args.positional[0]);
  const given = stringFlag(args, 'video');
  const video = given ? resolve(given) : outputsOf(spec.abs, spec.dir).video();
  if (!existsSync(video)) {
    throw new UserError(
      `video not found: ${video}. Run render first, or pass --video file.mp4.`,
    );
  }
  const cuts = await measureCuts(spec.film, video);
  console.log(
    args.flags.json === true ? JSON.stringify(cuts, null, 2) : formatCuts(cuts),
  );
  return 0;
}
