/**
 * @fileoverview Loudness: measuring a finished file, and normalising a
 * soundtrack in two passes. Levels are in LUFS (loudness) and dBTP (true
 * peak, decibels relative to full scale).
 */
import {UserError} from '../core/errors.ts';
import {run} from '../core/process.ts';

/** Loudness target for delivery files. */
export const LOUDNESS_TARGET = {
  /** Integrated loudness in LUFS. */
  integrated: -14,
  /** Highest true peak in dBTP. */
  truePeak: -1.5,
  /** Loudness range in LU. */
  range: 11,
} as const;

/** Result of {@link measureLoudness}. */
export interface Loudness {
  /** Integrated loudness in LUFS. `-Infinity` for silence. */
  lufs: number;
  /** True peak in dBTP. `-Infinity` for silence. */
  truePeak: number;
}

/** Options for {@link buildNormalizer}. */
export interface NormalizeOptions {
  /** Linear gain factor applied first. 1 leaves the level unchanged. */
  volume: number;
  /** Seconds of fade-out at the end of the audio. 0 for none. */
  fadeOut: number;
  /** Length of the film in seconds. The audio is padded or cut to it. */
  duration: number;
  /** Length of the audio file in seconds. */
  audioDuration: number;
}

/** A ready filter chain and what the first pass measured. */
export interface Normalizer {
  /** Value for ffmpeg `-af`. */
  filter: string;
  pass1: {
    /** Integrated loudness before normalising, in LUFS. */
    inputI: number;
    /** True peak before normalising, in dBTP. */
    inputTP: number;
  };
}

function parseNumber(text: string): number {
  return text === '-inf' ? -Infinity : Number(text);
}

/**
 * Measures integrated loudness and true peak of a file's audio with the
 * ebur128 filter.
 *
 * @throws UserError when the file has no measurable audio.
 */
export async function measureLoudness(file: string): Promise<Loudness> {
  const r = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      file,
      '-vn',
      '-af',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    {allowFail: true},
  );
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const i = summary.match(/\bI:\s+(-?[\d.]+|-inf)\s+LUFS/);
  const p = summary.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS/);
  if (!i?.[1] || !p?.[1]) {
    throw new UserError(`could not measure loudness of ${file}`);
  }
  return {lufs: parseNumber(i[1]), truePeak: parseNumber(p[1])};
}

function preChain(o: NormalizeOptions): string {
  const filters: string[] = [];
  if (o.volume !== 1) {
    filters.push(`volume=${o.volume}`);
  }
  filters.push(
    'aresample=48000',
    `apad=whole_dur=${o.duration}`,
    `atrim=0:${o.duration}`,
    'asetpts=PTS-STARTPTS',
  );
  const endAt = Math.min(o.duration, o.audioDuration);
  const fade = Math.min(o.fadeOut, endAt);
  if (fade > 0) {
    const start = (endAt - fade).toFixed(3);
    filters.push(`afade=t=out:st=${start}:d=${fade.toFixed(3)}`);
  }
  return filters.join(',');
}

type LoudnormJson = Record<string, string>;

/**
 * Builds the audio filter for a soundtrack: gain, fit to the film's length,
 * fade-out, then two-pass loudnorm to {@link LOUDNESS_TARGET}. Pass one
 * measures the track. Pass two uses the numbers in linear mode.
 *
 * @param audio Path of the soundtrack file.
 * @throws UserError when the measurement fails or the track is silent.
 */
export async function buildNormalizer(
  audio: string,
  options: NormalizeOptions,
): Promise<Normalizer> {
  const base = preChain(options);
  const t = LOUDNESS_TARGET;
  const target = `I=${t.integrated}:TP=${t.truePeak}:LRA=${t.range}`;
  const r = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      audio,
      '-vn',
      '-af',
      `${base},loudnorm=${target}:print_format=json`,
      '-f',
      'null',
      '-',
    ],
    {allowFail: true},
  );
  const m = r.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (r.code !== 0 || !m) {
    const tail = r.stderr.slice(-800);
    throw new UserError(`loudness measurement of the audio failed:\n${tail}`);
  }
  const j = JSON.parse(m[0]) as LoudnormJson;
  if (!Number.isFinite(Number(j.input_i))) {
    throw new UserError('the audio track is silent or too quiet to measure');
  }
  const measured =
    `measured_I=${j.input_i}:measured_TP=${j.input_tp}:` +
    `measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:` +
    `offset=${j.target_offset}:linear=true`;
  return {
    filter: `${base},loudnorm=${target}:${measured},aresample=48000`,
    pass1: {inputI: Number(j.input_i), inputTP: Number(j.input_tp)},
  };
}
