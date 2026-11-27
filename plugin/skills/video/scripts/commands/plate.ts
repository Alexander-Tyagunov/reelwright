/**
 * @fileoverview `plate`: checks a plate folder before a film uses it. It
 * reads `tracks.json`, lists the tracks and events, confirms that every frame
 * file exists, that the first frame has the stated size, and that no run of
 * frames is much darker or lighter than the frames around it.
 */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {Args} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {table} from '../core/table.ts';
import {describeRun, plateRuns} from '../qa/plate-brightness.ts';
import type {Plate} from '../shared/plate.ts';
import {parsePlate, plateFramePath, visibleShare} from '../shared/plate.ts';
import {frameBrightness} from '../video/brightness.ts';
import {probeStreams} from '../video/probe.ts';

function readPlate(path: string): Plate {
  if (!existsSync(path)) {
    throw new UserError(
      `plate file not found: ${path}. Pass the path of tracks.json.`,
    );
  }
  try {
    return parsePlate(JSON.parse(readFileSync(path, 'utf8')));
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new UserError(`${path}: ${why}`);
  }
}

function frameFiles(plate: Plate, path: string): string[] {
  const name = (i: number) => plateFramePath(plate, '', i);
  return Array.from({length: plate.frames}, (_, i) =>
    resolve(dirname(path), name(i)),
  );
}

/** Writes frame numbers as ranges, "2-12, 14", and stops after six ranges. */
function rangesOf(numbers: readonly number[]): string {
  const ranges: string[] = [];
  let from = 0;
  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i] ?? 0;
    if (numbers[i + 1] === n + 1) {
      continue;
    }
    const start = numbers[from] ?? n;
    ranges.push(start === n ? `${n}` : `${start}-${n}`);
    from = i + 1;
  }
  const shown = ranges.slice(0, 6).join(', ');
  return ranges.length > 6 ? `${shown}, and ${ranges.length - 6} more` : shown;
}

function printSummary(plate: Plate, path: string): void {
  const seconds = (plate.frames / plate.fps).toFixed(2);
  console.log(`plate: ${path}`);
  console.log(
    `  ${plate.frames} frames at ${plate.fps} fps = ${seconds} s, ` +
      `${plate.width}x${plate.height}`,
  );
  console.log(
    `  frames: ${plate.framePattern}, the first file is number ${plate.first}`,
  );
  const rows = Object.entries(plate.points).map(([name, p]) => [
    `    ${name}`,
    `${Math.round(visibleShare(p) * 100)}% of frames visible`,
    p.depth ? 'with depth' : '',
  ]);
  console.log(rows.length ? `  tracks:\n${table(rows)}` : '  tracks: none');
  const events = plate.events.map(
    e =>
      `${e.name} at frame ${e.frame} (${(e.frame / plate.fps).toFixed(2)} s)`,
  );
  console.log(`  events: ${events.join(', ') || 'none'}`);
}

async function firstFrameProblem(plate: Plate, file: string) {
  const {streams} = await probeStreams(file);
  const v = streams.find(s => s.type === 'video');
  if (v && v.width === plate.width && v.height === plate.height) {
    return null;
  }
  const found = v ? `${v.width}x${v.height}` : 'no picture';
  return (
    `the first frame ${file} is ${found}, but tracks.json says ` +
    `${plate.width}x${plate.height}. Render again at the stated size or ` +
    'correct width and height in tracks.json.'
  );
}

async function brightnessReport(plate: Plate, path: string): Promise<number> {
  const pattern = resolve(dirname(path), plate.framePattern);
  const runs = plateRuns(
    await frameBrightness([
      '-start_number',
      String(plate.first),
      '-i',
      pattern,
    ]),
  );
  if (!runs.length) {
    console.log(
      '  brightness: no run of frames stands out from its neighbours',
    );
    return 0;
  }
  console.log(`  brightness: ${runs.length} run(s) of odd frames`);
  for (const run of runs) {
    console.log(`    ${describeRun(run, plate.first)}`);
  }
  console.log(
    '    Render these frames again, then run plate again. If the change ' +
      'is on purpose, no fix is needed.',
  );
  return 1;
}

/**
 * Prints what a plate holds and checks it.
 *
 * @param args `plate tracks.json`.
 * @returns 0 when every frame file exists, the first frame has the stated
 *   size and no run of frames has odd brightness; 1 when the brightness
 *   check lists runs.
 * @throws UserError for a missing or invalid `tracks.json`, a missing frame
 *   file, or a first frame of the wrong size.
 */
export async function run(args: Args): Promise<number> {
  const given = args.positional[0];
  if (!given) {
    throw new UserError('missing plate path, e.g. plates/shot03/tracks.json');
  }
  const path = resolve(given);
  const plate = readPlate(path);
  printSummary(plate, path);
  const files = frameFiles(plate, path);
  const missing = files.flatMap((f, i) => (existsSync(f) ? [] : [i]));
  if (missing.length) {
    const present = plate.frames - missing.length;
    throw new UserError(
      `only ${present} of ${plate.frames} frame files are present (a ` +
        'partial plate, such as a check render). Missing frame files: ' +
        `${rangesOf(missing.map(i => i + plate.first))}. Render those ` +
        'frames or copy them into the plate folder, then run plate again.',
    );
  }
  const problem = await firstFrameProblem(plate, files[0] ?? '');
  if (problem) {
    throw new UserError(problem);
  }
  console.log(
    `  frame files: all ${plate.frames} present; the first is ` +
      `${plate.width}x${plate.height} as stated`,
  );
  return brightnessReport(plate, path);
}
