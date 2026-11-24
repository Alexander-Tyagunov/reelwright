/**
 * @fileoverview `export`: turns the rendered master into delivery files.
 * It never redraws frames. ffmpeg converts the master.
 */
import {copyFileSync, mkdirSync, renameSync} from 'node:fs';
import {dirname, extname} from 'node:path';
import type {Args} from '../core/args.ts';
import {numberFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {run as exec} from '../core/process.ts';
import {loadSpec} from '../core/spec.ts';
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

async function buildPlan(
  name: string,
  args: Args,
  ctx: EncodeContext,
): Promise<EncodePlan> {
  if (name === 'gif') {
    const fps = numberFlag(args, 'gif-fps') ?? 15;
    return gifPlan(ctx, fps, numberFlag(args, 'gif-width') ?? 960);
  }
  return name === 'webm' ? webmPlan(ctx) : mp4Plan(ctx);
}

async function checkLoudness(
  out: string,
  warnings: string[],
): Promise<Loudness> {
  const loud = await measureLoudness(out);
  if (loud.lufs < -16 || loud.lufs > -12) {
    warnings.push(
      `integrated loudness ${loud.lufs} LUFS is outside -16..-12 LUFS`,
    );
  }
  if (loud.truePeak > -1.0) {
    warnings.push(`true peak ${loud.truePeak} dBTP is above -1.0 dBTP`);
  }
  return loud;
}

function sizeWarnings(name: string, bytes: number, warnings: string[]): void {
  const mb = megabytes(bytes);
  if (name === 'gif' && bytes > 15 * 1048576) {
    warnings.push(
      `the GIF is ${mb} MB, over 15 MB; lower --gif-fps or --gif-width, ` +
        'or use the webm/mp4 preset',
    );
  }
  if (name === 'slack' && bytes > 25 * 1048576) {
    warnings.push(`${mb} MB is over the ~25 MB hint for inline play in Slack`);
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
  await exec('ffmpeg', plan.args);
  renameSync(ctx.tmp, out);
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
