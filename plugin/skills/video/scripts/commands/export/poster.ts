/**
 * @fileoverview The optional poster image of an export: one PNG frame cut
 * from the master.
 */
import {statSync} from 'node:fs';
import {extname} from 'node:path';
import {openFilm} from '../../browser/film.ts';
import type {Args} from '../../core/args.ts';
import {stringFlag} from '../../core/args.ts';
import {UserError} from '../../core/errors.ts';
import {run as exec} from '../../core/process.ts';
import {FFMPEG_HEAD} from './encode.ts';
import type {Poster} from './report.ts';

async function posterTime(args: Args, flag: string | true): Promise<number> {
  if (flag === true || flag === 'auto') {
    const film = await openFilm(args.positional[0], {
      size: stringFlag(args, 'size'),
    });
    try {
      return film.info.scenes[film.info.scenes.length - 1]?.check ?? 0;
    } finally {
      await film.close();
    }
  }
  const t = Number(flag);
  if (flag.trim() === '' || !Number.isFinite(t) || t < 0) {
    throw new UserError(`--poster must be "auto" or seconds, got "${flag}"`);
  }
  return t;
}

/**
 * Cuts a poster frame when `--poster` is given.
 *
 * @param args `--poster auto` (a moment the last scene is at rest) or
 *   `--poster <seconds>`.
 * @param duration Length of the master in seconds.
 * @returns The poster, or null when the flag is absent.
 * @throws UserError when the time is invalid or past the end.
 */
export async function makePoster(
  args: Args,
  master: string,
  out: string,
  duration: number,
): Promise<Poster | null> {
  const flag = args.flags.poster;
  if (flag === undefined || flag === false) {
    return null;
  }
  const t = await posterTime(args, flag);
  if (t > duration) {
    throw new UserError(
      `poster time ${t}s is past the end of the film (${duration}s)`,
    );
  }
  const file = `${out.slice(0, out.length - extname(out).length)}.png`;
  const head = [...FFMPEG_HEAD, '-ss', String(t), '-i', master];
  await exec('ffmpeg', [...head, '-frames:v', '1', file]);
  return {file, time: t, sizeBytes: statSync(file).size};
}
