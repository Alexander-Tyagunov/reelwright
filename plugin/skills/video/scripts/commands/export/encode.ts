/**
 * @fileoverview ffmpeg argument lists for each export preset. They never
 * redraw frames: they convert the rendered master.
 */
import {UserError} from '../../core/errors.ts';
import {buildNormalizer, LOUDNESS_TARGET} from '../../video/loudness.ts';
import type {MediaFacts, VideoFacts} from '../../video/probe.ts';
import {probe} from '../../video/probe.ts';

/** Everything the argument builders need to know. */
export interface EncodeContext {
  /** Path of the rendered master. */
  master: string;
  /** Facts about the master. Its video stream must exist. */
  facts: MediaFacts & {video: VideoFacts};
  /** Path of the soundtrack, or null. */
  audio: string | null;
  /** Linear gain for the soundtrack. */
  volume: number;
  /** Seconds of fade-out for the soundtrack. */
  fadeOut: number;
  /** Temporary output path. */
  tmp: string;
  /** Messages for the user. Builders add to it. */
  warnings: string[];
}

/** An ffmpeg command ready to run. */
export interface EncodePlan {
  /** Arguments after `ffmpeg`. */
  args: string[];
  /** One line for the report, or an empty string. */
  note: string;
}

const HEAD = ['-hide_banner', '-loglevel', 'error', '-y'];

/** Arguments that every export command starts with. */
export const FFMPEG_HEAD: readonly string[] = HEAD;

/** Plan for the GIF preset: two-pass palette, `fps` and `width` in px. */
export function gifPlan(
  ctx: EncodeContext,
  fps: number,
  want: number,
): EncodePlan {
  if (ctx.audio) {
    ctx.warnings.push('--audio is ignored: GIF has no sound');
  }
  const even = Math.max(2, Math.round(want / 2) * 2);
  const width = Math.min(even, ctx.facts.video.width);
  const graph =
    `fps=${fps},scale=${width}:-2:flags=lanczos,split[a][b];` +
    '[a]palettegen=stats_mode=diff[p];' +
    '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle';
  return {
    args: [
      ...HEAD,
      '-i',
      ctx.master,
      '-an',
      '-filter_complex',
      graph,
      '-loop',
      '0',
      ctx.tmp,
    ],
    note: `${fps} fps, ${width} px wide`,
  };
}

async function loadSoundtrack(ctx: EncodeContext, audio: string) {
  const facts = await probe(audio);
  if (!facts.audio) {
    throw new UserError(`${audio} has no audio stream`);
  }
  const chain = await buildNormalizer(audio, {
    volume: ctx.volume,
    fadeOut: ctx.fadeOut,
    duration: ctx.facts.duration,
    audioDuration: facts.duration,
  });
  return {facts, chain};
}

/** Plan for the WebM preset: VP9 CRF 32, Opus 128k when there is audio. */
export async function webmPlan(ctx: EncodeContext): Promise<EncodePlan> {
  const args = [...HEAD, '-i', ctx.master];
  if (ctx.audio) {
    const {chain} = await loadSoundtrack(ctx, ctx.audio);
    args.push(
      '-i',
      ctx.audio,
      '-map',
      '0:v',
      '-map',
      '1:a',
      '-af',
      chain.filter,
      '-c:a',
      'libopus',
      '-b:a',
      '128k',
    );
  } else {
    args.push('-map', '0:v');
    if (ctx.facts.audio) {
      args.push('-map', '0:a?', '-c:a', 'libopus', '-b:a', '128k');
    }
  }
  args.push(
    '-c:v',
    'libvpx-vp9',
    '-crf',
    '32',
    '-b:v',
    '0',
    '-row-mt',
    '1',
    '-pix_fmt',
    'yuv420p',
    '-shortest',
    ctx.tmp,
  );
  return {args, note: 'VP9 CRF 32'};
}

function videoArgs(ctx: EncodeContext): string[] {
  const v = ctx.facts.video;
  if (v.codec === 'h264' && v.pixFmt === 'yuv420p') {
    return ['-c:v', 'copy'];
  }
  ctx.warnings.push(
    `the master is ${v.codec}/${v.pixFmt}, not H.264 yuv420p, so the video ` +
      'was re-encoded with libx264 CRF 18',
  );
  return [
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '18',
    '-preset',
    'medium',
  ];
}

/** Plan for the MP4 presets: copy H.264 video, AAC 192k audio. */
export async function mp4Plan(ctx: EncodeContext): Promise<EncodePlan> {
  const args = [...HEAD, '-i', ctx.master];
  const video = videoArgs(ctx);
  let note = '';
  if (ctx.audio) {
    const {facts, chain} = await loadSoundtrack(ctx, ctx.audio);
    if (facts.duration + 0.05 < ctx.facts.duration) {
      ctx.warnings.push(
        `the audio (${facts.duration}s) is shorter than the film ` +
          `(${ctx.facts.duration}s); the rest is silent`,
      );
    }
    const {inputI, inputTP} = chain.pass1;
    note =
      `audio: loudnorm pass 1 measured ${inputI} LUFS / ${inputTP} dBTP ` +
      `before normalising to ${LOUDNESS_TARGET.integrated} LUFS`;
    args.push('-i', ctx.audio, '-map', '0:v', '-map', '1:a', ...video);
    args.push('-af', chain.filter, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  } else if (ctx.facts.audio) {
    const copy = ctx.facts.audio.codec === 'aac';
    args.push('-map', '0:v', '-map', '0:a', ...video);
    args.push('-c:a', copy ? 'copy' : 'aac', ...(copy ? [] : ['-b:a', '192k']));
  } else {
    args.push('-map', '0:v', ...video);
  }
  args.push('-movflags', '+faststart', ctx.tmp);
  return {args, note};
}
