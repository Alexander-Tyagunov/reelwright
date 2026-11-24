/**
 * @fileoverview The H.264 encoder: screenshots go in through a pipe, an MP4
 * file comes out. Colour is converted from screenshot RGB to BT.709
 * broadcast range, and tagged, so players show the same colours.
 */

import type {ChildProcessByStdio} from 'node:child_process';
import {spawn} from 'node:child_process';
import {renameSync} from 'node:fs';
import type {Readable, Writable} from 'node:stream';
import {UserError} from '../core/errors.ts';

/** Options for {@link openEncoder}. */
export interface EncoderOptions {
  /** Output path ending in `.mp4`. */
  out: string;
  /** Frames per second of the output. */
  fps: number;
  /** x264 constant rate factor. Lower is better. Default 18. */
  crf?: number;
  /** True when the piped frames are PNG, false for JPEG. Default false. */
  png?: boolean;
  /** x264 preset name. Default `medium`. */
  preset?: string;
  /** Output size as `width:height` in pixels. Default: input size. */
  scale?: string | null;
}

/** An open encoder. */
export interface Encoder {
  /** Sends one frame. Resolves when ffmpeg can take the next one. */
  write(frame: Uint8Array): Promise<void>;
  /** Ends the input, waits for ffmpeg and moves the file to `out`. */
  finish(): Promise<void>;
}

/**
 * Colour filter from screenshots to BT.709 `yuv420p` in broadcast range.
 * Chrome writes JPEG as full-range BT.601 and PNG as RGB.
 *
 * @param png True for PNG input.
 */
export function colorFilter(png: boolean): string {
  const inputTags = png ? '' : 'in_color_matrix=bt601:in_range=pc:';
  return (
    `scale=${inputTags}out_color_matrix=bt709:out_range=tv:` +
    'flags=accurate_rnd+full_chroma_int,format=yuv420p'
  );
}

/** Output colour tags that match {@link colorFilter}. */
export const COLOR_TAGS: readonly string[] = [
  '-colorspace',
  'bt709',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-color_range',
  'tv',
];

function buildArgs(o: EncoderOptions, tmp: string): string[] {
  const png = o.png ?? false;
  const filters = [colorFilter(png)];
  if (o.scale) {
    filters.push(`scale=${o.scale}:flags=bilinear`);
  }
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'image2pipe',
    '-c:v',
    png ? 'png' : 'mjpeg',
    '-framerate',
    String(o.fps),
    '-i',
    '-',
    '-vf',
    filters.join(','),
    '-c:v',
    'libx264',
    '-preset',
    o.preset ?? 'medium',
    '-crf',
    String(o.crf ?? 18),
    '-pix_fmt',
    'yuv420p',
    ...COLOR_TAGS,
    '-r',
    String(o.fps),
    '-g',
    String(o.fps * 2),
    '-video_track_timescale',
    '15360',
    '-movflags',
    '+faststart',
    tmp,
  ];
}

/** Collects ffmpeg's messages and settles when the process ends. */
function watch(child: ChildProcessByStdio<Writable, null, Readable>) {
  let log = '';
  child.stderr.on('data', (d: Buffer) => {
    log += d.toString();
  });
  return new Promise<void>((resolve, reject) => {
    child.on('error', e =>
      reject(new UserError(`could not start ffmpeg: ${e.message}`)),
    );
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new UserError(`ffmpeg exited ${code}: ${log.slice(-800)}`));
      }
    });
  });
}

/**
 * Starts ffmpeg to encode piped screenshots to H.264.
 *
 * The encoder writes to `<out>.tmp.mp4` and renames it when finished, so a
 * stopped render never leaves a short file that still plays.
 *
 * @throws UserError from `write` or `finish` when ffmpeg fails.
 */
export function openEncoder(options: EncoderOptions): Encoder {
  const tmp = `${options.out.replace(/\.mp4$/, '')}.tmp.mp4`;
  const child = spawn('ffmpeg', buildArgs(options, tmp), {
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  const done = watch(child);
  let failure: Error | null = null;
  done.catch(e => {
    failure = e;
  });
  child.stdin.on('error', e => {
    failure ??= new UserError(`ffmpeg closed its input early: ${e.message}`);
  });
  return {
    write(frame) {
      if (failure) {
        return Promise.reject(failure);
      }
      if (child.stdin.write(frame)) {
        return Promise.resolve();
      }
      return new Promise(resolve => child.stdin.once('drain', resolve));
    },
    async finish() {
      child.stdin.end();
      await done;
      renameSync(tmp, options.out);
    },
  };
}
