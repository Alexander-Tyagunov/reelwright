/**
 * @fileoverview `stills`: draws full-size stills and one contact sheet.
 * By default it draws each scene at the moment it has the most on screen.
 * With `--at` or `--every` it draws a strip into its own folder, so the
 * scene stills stay in place.
 */
import {mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {FilmPage} from '../browser/film.ts';
import {frameAt, openFilm, pageErrors} from '../browser/film.ts';
import type {Args} from '../core/args.ts';
import {boolFlag, numberFlag, stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {outputsOf} from '../core/outputs.ts';
import type {FilmInfo} from '../shared/contract.ts';
import type {SheetGrid} from '../video/contact-sheet.ts';
import {makeContactSheet} from '../video/contact-sheet.ts';

/** One still to draw. */
interface Shot {
  /** Time in seconds from the start of the film. */
  t: number;
  /** File name without extension. */
  name: string;
}

function timeName(t: number): string {
  return `t${t.toFixed(2)}`;
}

/** Reads `--at 1.5,3` into times in seconds. */
function parseAt(text: string): number[] {
  return text.split(',').map(part => {
    const t = Number(part);
    if (part.trim() === '' || !Number.isFinite(t)) {
      throw new UserError(
        '--at must be a comma-separated list of times in seconds, ' +
          `e.g. --at 1.5,3; got "${text}"`,
      );
    }
    return t;
  });
}

/** The stills to draw and the output name they are saved under. */
interface Plan {
  shots: Shot[];
  /** `stills` for one still per scene, `strip` for chosen times. */
  kind: 'stills' | 'strip';
}

/** Times from `--from` to `--to` in steps of `--every`, both ends included. */
function everyShots(every: number, from: number, end: number): Shot[] {
  const shots: Shot[] = [];
  for (let i = 0; from + i * every <= end + 1e-9; i++) {
    const t = Number((from + i * every).toFixed(3));
    shots.push({t, name: timeName(t)});
  }
  return shots;
}

/** Chooses the stills from `--at`, `--every`, or the scene check times. */
function planShots(args: Args, info: FilmInfo): Plan {
  const seconds = 'a number of seconds';
  const from = numberFlag(args, 'from', seconds);
  const to = numberFlag(args, 'to', seconds);
  const every = numberFlag(args, 'every', seconds);
  const at = stringFlag(args, 'at');
  if (every !== undefined) {
    if (!(every > 0)) {
      throw new UserError(
        '--every must be a number greater than 0 ' +
          `(seconds between stills), got "${every}"`,
      );
    }
    const lastFrame = (info.frames - 1) / info.fps;
    const start = from ?? 0;
    const end = to ?? lastFrame;
    if (!(start < end)) {
      throw new UserError(
        `--from (${start}s) must be less than --to (${end}s). ` +
          'Give --from a time before --to, both in seconds.',
      );
    }
    return {shots: everyShots(every, start, end), kind: 'strip'};
  }
  if (at !== undefined) {
    const shots = parseAt(at).map(t => ({t, name: timeName(t)}));
    return {shots, kind: 'strip'};
  }
  const shots = info.scenes.map(s => ({
    t: s.check,
    name: `${String(s.index + 1).padStart(2, '0')}-${s.type}`,
  }));
  return {shots, kind: 'stills'};
}

/** Checks every shot time before anything on disk is changed. */
function checkShots(shots: Shot[], info: FilmInfo): void {
  if (!shots.length) {
    throw new UserError(
      'no stills to draw. Check --at, or --every with --from and --to.',
    );
  }
  for (const s of shots) {
    if (!(s.t >= 0 && s.t <= info.duration)) {
      throw new UserError(
        `still time ${s.t}s is outside the film (0 to ${info.duration}s). ` +
          'Pick times inside that range.',
      );
    }
  }
}

/** Draws each shot, saves it as a JPEG and returns the encoded frames. */
async function drawShots(
  page: FilmPage,
  shots: Shot[],
  dir: string,
): Promise<Buffer[]> {
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  const frames: Buffer[] = [];
  for (const s of shots) {
    const buf = await frameAt(page, s.t);
    writeFileSync(join(dir, `${s.name}.jpg`), buf);
    frames.push(buf);
  }
  return frames;
}

function printReport(
  info: FilmInfo,
  shots: Shot[],
  dir: string,
  sheet: string,
  grid: SheetGrid,
): void {
  const clock = `${info.fps} fps, ${info.duration}s`;
  console.log(
    `film: ${info.width}x${info.height} ${clock}, ${info.scenes.length} scenes`,
  );
  console.log(`stills: ${dir} (${readdirSync(dir).length} files)`);
  shots.forEach((s, i) => {
    const row = String(i + 1).padStart(2);
    console.log(`  ${row}  ${s.t.toFixed(2)}s  ${join(dir, `${s.name}.jpg`)}`);
  });
  console.log(
    `contact sheet: ${sheet} (${grid.cols}x${grid.rows}, ` +
      'reading order = the list above)',
  );
  for (const w of info.warnings) {
    console.log(`warning: ${w}`);
  }
  if (info.missingFonts.length) {
    const names = info.missingFonts.join(', ');
    console.log(`warning: fonts not available, a fallback is drawn: ${names}`);
  }
}

/**
 * Draws one still per scene into `out/stills[-WxH]/` with the contact sheet
 * `out/contact[-WxH].jpg`, next to the spec; a spec not called `film.json`
 * prefixes every name with its own, as in `out/film-desk.stills/`. With `--at` or `--every` the
 * stills go to `out/strip[-WxH]/` and the sheet to `out/strip[-WxH].jpg`.
 *
 * @param args `stills film.json [--at 1.5,3 | --every S [--from S] [--to S]]
 *   [--size WxH] [--gpu]`. Times are in seconds.
 * @returns 0, or 1 when the page reported errors.
 * @throws UserError for a bad option or a time outside the film.
 */
export async function run(args: Args): Promise<number> {
  const size = stringFlag(args, 'size');
  const film = await openFilm(args.positional[0], {
    size,
    gpu: boolFlag(args, 'gpu'),
  });
  try {
    const {info, page, spec} = film;
    const suffix = size ? `-${size}` : '';
    const {shots, kind} = planShots(args, info);
    checkShots(shots, info);
    const names = outputsOf(spec.abs, spec.dir);
    const dir = names.stills(kind, suffix);
    const frames = await drawShots(page, shots, dir);
    const sheet = names.sheet(kind, suffix);
    const grid = await makeContactSheet(frames, sheet, film);
    printReport(info, shots, dir, sheet, grid);
    const errors = await pageErrors(page);
    if (errors.length) {
      console.log(`page errors:\n  ${errors.join('\n  ')}`);
      return 1;
    }
    return 0;
  } finally {
    await film.close();
  }
}
