/**
 * @fileoverview `render`: draws the film to an MP4, one file per scene,
 * joined without re-encoding. Unchanged scenes are reused from the cache in
 * `out/.segments/`, or `out/.<spec name>.segments/` for another spec name.
 */
import {existsSync, mkdirSync} from 'node:fs';
import {cpus} from 'node:os';
import {dirname, resolve} from 'node:path';
import type {FilmPage, OpenFilm} from '../browser/film.ts';
import {openFilm, pageErrors} from '../browser/film.ts';
import type {Args} from '../core/args.ts';
import {boolFlag, numberFlag, stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {outputsOf} from '../core/outputs.ts';
import {checkFps, checkRange} from '../core/validate.ts';
import {drawSegments} from './render/draw.ts';
import {joinSegments} from './render/join.ts';
import type {RenderSettings, Segment} from './render/plan.ts';
import {outputSize, planSegments} from './render/plan.ts';
import {soundForRender} from './render/sound.ts';
import {writeSummary} from './render/summary.ts';

const DEFAULT_JOBS = 2;

function settingsFrom(args: Args, film: OpenFilm): RenderSettings {
  const draft = boolFlag(args, 'draft');
  const {info} = film;
  const asked = numberFlag(args, 'fps');
  const fps = draft
    ? Math.min(15, info.fps)
    : checkFps('--fps', asked ?? info.fps);
  const crf = checkRange(
    '--crf',
    numberFlag(args, 'crf') ?? (draft ? 28 : 18),
    0,
    51,
  );
  const png = boolFlag(args, 'png');
  return {width: film.width, height: film.height, fps, crf, png, draft};
}

async function openPages(film: OpenFilm, count: number): Promise<FilmPage[]> {
  const pages = [film.page];
  while (pages.length < count) {
    pages.push(await film.newPage());
  }
  return pages;
}

function reportReused(segments: Segment[], todo: Segment[]): void {
  for (const s of segments.filter(seg => !todo.includes(seg))) {
    const label = `${String(s.index + 1).padStart(2)} ${s.type.padEnd(12)}`;
    console.log(`  scene ${label} ${s.to - s.from} frames reused`);
  }
}

async function failOnPageErrors(pages: FilmPage[]): Promise<void> {
  const errors: string[] = [];
  for (const page of pages) {
    errors.push(...(await pageErrors(page)));
  }
  if (errors.length) {
    const unique = [...new Set(errors)].join('\n  ');
    throw new UserError(
      `the page reported errors while rendering:\n  ${unique}`,
    );
  }
}

async function renderFilm(args: Args, film: OpenFilm): Promise<void> {
  const started = Date.now();
  const {info, spec} = film;
  const settings = settingsFrom(args, film);
  const {fps, draft} = settings;
  const frames =
    fps === info.fps ? info.frames : Math.round(info.duration * fps);
  const size = stringFlag(args, 'size');
  const suffix = (size ? `-${size}` : '') + (draft ? '-draft' : '');
  const outArg = stringFlag(args, 'out');
  const names = outputsOf(spec.abs, spec.dir);
  const out = outArg ? resolve(outArg) : names.video(suffix);
  const segDir = names.segments();
  mkdirSync(dirname(out), {recursive: true});
  mkdirSync(segDir, {recursive: true});

  const segments = planSegments(film, settings, segDir, frames);
  const force = boolFlag(args, 'force');
  const todo = segments.filter(s => force || !existsSync(s.file));
  const wanted = numberFlag(args, 'jobs') ?? DEFAULT_JOBS;
  const jobs = Math.max(1, Math.min(wanted, cpus().length, todo.length || 1));
  const pages = await openPages(film, jobs);
  const out2 = outputSize(settings);
  await drawSegments(pages, todo, settings, {
    preset: draft ? 'veryfast' : 'medium',
    scale: draft ? `${out2.width}:${out2.height}` : null,
  });
  reportReused(segments, todo);
  await failOnPageErrors(pages);
  const sound = await soundForRender(film, args);
  await joinSegments(segments, segDir, out, sound?.file ?? null);
  writeSummary({
    ...{film, settings, out, suffix, frames, segments, todo, started},
    sound,
  });
}

/**
 * Renders the film to `out/<spec name>[-WxH][-draft].mp4` next to the spec,
 * and writes `render[...].json` with the facts `qa` checks. A spec called
 * `film.json` writes `out/film.mp4`; `film-desk.json` writes
 * `out/film-desk.mp4` and `out/film-desk.render.json`.
 *
 * @param args `render film.json [--size WxH] [--draft] [--fps N] [--crf N]
 *   [--png] [--jobs N] [--force] [--out file.mp4] [--gpu] [--no-sound]`.
 *   With `meta.sound` on, the generated sound is added as AAC audio and
 *   the video is copied, not re-encoded. `--no-sound` renders silent.
 *   Draft mode uses at most 15 fps, frames with half the width and
 *   half the height, and CRF 28.
 * @returns 0.
 * @throws UserError when the page reports errors or ffmpeg fails.
 */
export async function run(args: Args): Promise<number> {
  const film = await openFilm(args.positional[0], {
    size: stringFlag(args, 'size'),
    gpu: boolFlag(args, 'gpu'),
  });
  try {
    await renderFilm(args, film);
    return 0;
  } finally {
    await film.close();
  }
}
