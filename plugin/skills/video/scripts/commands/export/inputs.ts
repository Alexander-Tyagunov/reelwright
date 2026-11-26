/**
 * @fileoverview Reads and checks the inputs of `export`: the preset, the
 * master video, the soundtrack and the output path.
 */
import {existsSync} from 'node:fs';
import {basename, extname, join, resolve} from 'node:path';
import type {Args} from '../../core/args.ts';
import {stringFlag} from '../../core/args.ts';
import {UserError} from '../../core/errors.ts';
import type {Outputs} from '../../core/outputs.ts';
import type {MediaFacts, VideoFacts} from '../../video/probe.ts';
import {probe} from '../../video/probe.ts';
import {PRESET_NAMES, PRESETS} from './presets.ts';

/** Facts about a file that is known to have a video stream. */
export type VideoMedia = MediaFacts & {video: VideoFacts};

/** Chooses the output path from `--out` or the default folder. */
export function outputPath(
  args: Args,
  master: string,
  names: Outputs,
  name: string,
) {
  const ext = PRESETS[name]?.ext ?? 'mp4';
  const fallback = join(
    names.exports(),
    `${basename(master, extname(master))}-${name}.${ext}`,
  );
  const outArg = stringFlag(args, 'out');
  if (!outArg) {
    return fallback;
  }
  const abs = resolve(outArg);
  return extname(abs) ? abs : join(abs, basename(fallback));
}

/**
 * Finds and probes the master video: `--video`, or
 * `out/<spec name>[-WxH].mp4`.
 *
 * @returns The master path and its facts.
 * @throws UserError when it is missing or has no video stream.
 */
export async function loadMaster(
  args: Args,
  names: Outputs,
): Promise<[string, VideoMedia]> {
  const video = stringFlag(args, 'video');
  const size = stringFlag(args, 'size');
  const master = video ? resolve(video) : names.video(size ? `-${size}` : '');
  if (!existsSync(master)) {
    const flag = size ? ` --size ${size}` : '';
    const again = `reel render ${args.positional[0]}${flag}`;
    throw new UserError(
      `master video not found: ${master}\n` +
        `Run "${again}" first, or pass --video path.`,
    );
  }
  const facts = await probe(master);
  if (!facts.video) {
    throw new UserError(`${master} has no video stream`);
  }
  return [master, {...facts, video: facts.video}];
}

/**
 * Reads `--audio`.
 *
 * @returns The absolute path, or null when the flag is absent.
 * @throws UserError when the flag has no value or the file is missing.
 */
export function soundtrack(args: Args): string | null {
  if (args.flags.audio === true) {
    throw new UserError('--audio needs a file path, e.g. --audio music.mp3');
  }
  const audio = stringFlag(args, 'audio');
  if (audio && !existsSync(resolve(audio))) {
    throw new UserError(`audio file not found: ${resolve(audio)}`);
  }
  return audio ? resolve(audio) : null;
}

/**
 * Reads and checks `--preset`.
 *
 * @throws UserError when it is missing or unknown.
 */
export function presetName(args: Args): string {
  const name = stringFlag(args, 'preset');
  const names = PRESET_NAMES.join(', ');
  if (!name) {
    throw new UserError(
      `--preset is required. Choose one of: ${names} ` +
        '(run with --preset list for details)',
    );
  }
  if (!PRESETS[name]) {
    throw new UserError(`unknown preset "${name}". Choose one of: ${names}`);
  }
  return name;
}
