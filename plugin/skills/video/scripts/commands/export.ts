/**
 * @fileoverview `export`: turns the rendered master into delivery files.
 * It never redraws frames. ffmpeg converts the master.
 */
import {copyFileSync, mkdirSync, renameSync, rmSync} from 'node:fs';
import {dirname, extname} from 'node:path';
import type {Args} from '../core/args.ts';
import {numberFlag} from '../core/args.ts';
import {onStop} from '../core/cleanup.ts';
import {UserError} from '../core/errors.ts';
import {run as exec} from '../core/process.ts';
import {loadSpec} from '../core/spec.ts';
import {checkPositive} from '../core/validate.ts';
import {LUFS_MAX, LUFS_MIN, TRUE_PEAK_MAX} from '../qa/thresholds.ts';
import type {Loudness} from '../video/loudness.ts';
import {measureLoudness} from '../video/loudness.ts';
import {probe} from '../video/probe.ts';
import type {EncodeContext, EncodePlan} from './export/encode.ts';
import {gifPlan, mp4Plan, webmPlan} from './export/encode.ts';
import type {VideoMedia} from './export/inputs.ts';
import {
  loadMaster,
  outputPath,
  presetName,
  soundtrack,
} from './export/inputs.ts';
import {makePoster} from './export/poster.ts';
import type {Preset} from './export/presets.ts';
import {PRESETS, presetListing} from './export/presets.ts';
import type {ExportResult} from './export/report.ts';
import {megabytes, printResult, recordResult} from './export/report.ts';

/** Bytes in one megabyte, as the size limits below count them. */
const MB = 1048576;

/** Largest GIF, in megabytes, before the export warns. */
const GIF_MAX_MB = 15;

/** Size in megabytes above which Slack may not play a file inline. */
const SLACK_HINT_MB = 25;

async function buildPlan(
  name: string,
  args: Args,
  ctx: EncodeContext,
): Promise<EncodePlan> {
  if (name === 'gif') {
    const fps = checkPositive('--gif-fps', numberFlag(args, 'gif-fps') ?? 15);
    const width = numberFlag(args, 'gif-width') ?? 960;
    return gifPlan(ctx, fps, checkPositive('--gif-width', width));
  }
  return name === 'webm' ? webmPlan(ctx) : mp4Plan(ctx);
}

async function checkLoudness(
  out: string,
  warnings: string[],
): Promise<Loudness> {
  const loud = await measureLoudness(out);
  if (loud.lufs < LUFS_MIN || loud.lufs > LUFS_MAX) {
    warnings.push(
      `integrated loudness ${loud.lufs} LUFS is outside ` +
        `${LUFS_MIN}..${LUFS_MAX} LUFS`,
    );
  }
  if (loud.truePeak > TRUE_PEAK_MAX) {
    warnings.push(
      `true peak ${loud.truePeak} dBTP is above ${TRUE_PEAK_MAX} dBTP`,
    );
  }
  return loud;
}

function sizeWarnings(name: string, bytes: number, warnings: string[]): void {
  const mb = megabytes(bytes);
  if (name === 'gif' && bytes > GIF_MAX_MB * MB) {
    warnings.push(
      `the GIF is ${mb} MB, over ${GIF_MAX_MB} MB; ` +
        'lower --gif-fps or --gif-width, or use the webm/mp4 preset',
    );
  }
  if (name === 'slack' && bytes > SLACK_HINT_MB * MB) {
    warnings.push(
      `${mb} MB is over the ~${SLACK_HINT_MB} MB hint for inline play in Slack`,
    );
  }
}

/** Makes the output file. Returns the command text and the report note. */
async function produce(
  name: string,
  args: Args,
  ctx: EncodeContext,
  out: string,
): Promise<{command: string; note: string}> {
  if (name === 'master') {
    if (ctx.audio) {
      ctx.warnings.push(
        '--audio is ignored by the master preset (it copies the file ' +
          'unchanged); use mp4 preset such as web to add audio',
      );
    }
    copyFileSync(ctx.master, out);
    return {command: `copy ${ctx.master} ${out}`, note: ''};
  }
  const plan = await buildPlan(name, args, ctx);
  const dropTmp = (): void => rmSync(ctx.tmp, {force: true});
  const forget = onStop(dropTmp);
  try {
    await exec('ffmpeg', plan.args);
    renameSync(ctx.tmp, out);
  } catch (e) {
    dropTmp();
    throw e;
  } finally {
    forget();
  }
  return {command: `ffmpeg ${plan.args.join(' ')}`, note: plan.note};
}

function contextFrom(
  args: Args,
  master: string,
  facts: VideoMedia,
  out: string,
): EncodeContext {
  const volume = numberFlag(args, 'audio-volume') ?? 1;
  if (volume < 0) {
    throw new UserError('--audio-volume must be 0 or more');
  }
  const ext = extname(out);
  return {
    master,
    facts,
    audio: soundtrack(args),
    volume,
    fadeOut: numberFlag(args, 'fade-out') ?? 1,
    tmp: `${out.slice(0, out.length - ext.length)}.tmp${ext}`,
    warnings: [],
  };
}

/**
 * Exports the master video with one preset. Writes the file, optionally a
 * poster PNG next to it, and an entry in `export.json`.
 *
 * @param args `export film.json --preset <name> [--video master.mp4]
 *   [--size WxH] [--out path] [--audio file] [--audio-volume N]
 *   [--fade-out S] [--gif-fps N] [--gif-width PX] [--poster auto|S]`.
 *   Use `--preset list` to print the presets. Times are in seconds.
 * @returns 0.
 * @throws UserError for a bad option or a missing master or audio file.
 */
export async function run(args: Args): Promise<number> {
  if (args.flags.preset === 'list') {
    console.log(presetListing());
    return 0;
  }
  const spec = loadSpec(args.positional[0]);
  const name = presetName(args);
  const preset = PRESETS[name] as Preset;
  const [master, facts] = await loadMaster(args, spec.dir);
  const out = outputPath(args, master, spec.dir, name);
  mkdirSync(dirname(out), {recursive: true});
  const ctx = contextFrom(args, master, facts, out);
  const {command, note} = await produce(name, args, ctx, out);
  const outFacts = await probe(out);
  if (!outFacts.video) {
    throw new UserError(`${out} has no video stream`);
  }
  const measured =
    outFacts.audio && ctx.audio && name !== 'gif' && name !== 'master';
  const result: ExportResult = {
    name,
    preset,
    out,
    master,
    facts: {...outFacts, video: outFacts.video},
    loudness: measured ? await checkLoudness(out, ctx.warnings) : null,
    poster: null,
    warnings: ctx.warnings,
    command,
    note,
  };
  sizeWarnings(name, outFacts.size, ctx.warnings);
  result.poster = await makePoster(args, master, out, facts.duration);
  printResult(result);
  recordResult(result);
  return 0;
}
