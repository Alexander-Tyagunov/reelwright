/**
 * @fileoverview Reads facts about a media file with ffprobe.
 */
import {statSync} from 'node:fs';
import {run} from '../core/process.ts';

/** One stream, with ffprobe's fields under camelCase names. */
export interface StreamFacts {
  /** `video`, `audio`, `subtitle` or `data`. */
  type: string;
  codec: string;
  profile: string | undefined;
  pixFmt: string;
  /** Pixels. */
  width: number;
  /** Pixels. */
  height: number;
  /** Frames per second as a fraction such as `30/1`. */
  rFrameRate: string | undefined;
  /** Average frames per second as a fraction. */
  avgFrameRate: string | undefined;
  /** Frame count stored in the container, or null. */
  nbFrames: number | null;
  /** Packets read when `-count_packets` was passed, or null. */
  nbReadPackets: number | null;
  /** Bits per second, or null. */
  bitRate: number | null;
  /** Samples per second. 0 for video. */
  sampleRate: number;
  channels: number;
  /** Seconds, or null. */
  duration: number | null;
  colorSpace: string | undefined;
  colorRange: string | undefined;
}

/** What {@link probeStreams} returns. */
export interface StreamReport {
  streams: StreamFacts[];
  /** Container length in seconds, or null. */
  duration: number | null;
  /** Container size in bytes, or null. */
  size: number | null;
}

type RawStream = Record<string, string | number | undefined>;

/** Summary of the first video stream. */
export interface VideoFacts {
  codec: string;
  /** For example `High`. May be undefined. */
  profile: string | undefined;
  pixFmt: string;
  /** Pixels. */
  width: number;
  /** Pixels. */
  height: number;
  /** Frames per second, rounded to 3 decimals. */
  fps: number;
  /** Frame count when the container stores it, otherwise null. */
  frames: number | null;
  /** Bits per second, or null. */
  bitRate: number | null;
  gif: boolean;
}

/** Summary of the first audio stream. */
export interface AudioFacts {
  codec: string;
  /** Samples per second. */
  sampleRate: number;
  channels: number;
  /** Bits per second, or null. */
  bitRate: number | null;
}

/** What {@link probe} returns. */
export interface MediaFacts {
  /** File size in bytes. */
  size: number;
  /** Length in seconds, rounded to 3 decimals. */
  duration: number;
  video: VideoFacts | undefined;
  audio: AudioFacts | undefined;
}

function text(raw: RawStream, key: string): string | undefined {
  const v = raw[key];
  return v === undefined ? undefined : String(v);
}

function numberOrNull(raw: RawStream, key: string): number | null {
  const v = raw[key];
  return v === undefined || v === '' || Number.isNaN(Number(v))
    ? null
    : Number(v);
}

function toStream(raw: RawStream): StreamFacts {
  return {
    type: text(raw, 'codec_type') ?? '',
    codec: text(raw, 'codec_name') ?? '',
    profile: text(raw, 'profile'),
    pixFmt: text(raw, 'pix_fmt') ?? '',
    width: numberOrNull(raw, 'width') ?? 0,
    height: numberOrNull(raw, 'height') ?? 0,
    rFrameRate: text(raw, 'r_frame_rate'),
    avgFrameRate: text(raw, 'avg_frame_rate'),
    nbFrames: numberOrNull(raw, 'nb_frames'),
    nbReadPackets: numberOrNull(raw, 'nb_read_packets'),
    bitRate: numberOrNull(raw, 'bit_rate'),
    sampleRate: numberOrNull(raw, 'sample_rate') ?? 0,
    channels: numberOrNull(raw, 'channels') ?? 0,
    duration: numberOrNull(raw, 'duration'),
    colorSpace: text(raw, 'color_space'),
    colorRange: text(raw, 'color_range'),
  };
}

/**
 * Runs ffprobe and returns every stream plus the container length.
 *
 * @param extra Extra ffprobe options, for example `['-count_packets']`.
 * @throws UserError when ffprobe is missing or the file cannot be read.
 */
export async function probeStreams(
  file: string,
  extra: readonly string[] = [],
): Promise<StreamReport> {
  const r = await run('ffprobe', [
    '-v',
    'error',
    ...extra,
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  const json = JSON.parse(r.stdout) as {
    streams?: RawStream[];
    format?: RawStream;
  };
  const format = json.format ?? {};
  return {
    streams: (json.streams ?? []).map(toStream),
    duration: numberOrNull(format, 'duration'),
    size: numberOrNull(format, 'size'),
  };
}

/** Converts a fraction such as `30000/1001` to a number. 0 when invalid. */
export function parseFraction(value: string | undefined): number {
  const [x, y] = String(value ?? '0/1')
    .split('/')
    .map(Number);
  return y ? (x ?? 0) / y : 0;
}

/**
 * Summarises a media file: size, length and its first video and audio
 * streams.
 *
 * @throws UserError when ffprobe fails.
 */
export async function probe(file: string): Promise<MediaFacts> {
  const report = await probeStreams(file);
  const v = report.streams.find(s => s.type === 'video');
  const a = report.streams.find(s => s.type === 'audio');
  const fps = parseFraction(v?.avgFrameRate || v?.rFrameRate);
  return {
    size: statSync(file).size,
    duration: Number((report.duration ?? 0).toFixed(3)),
    video: v && {
      codec: v.codec,
      profile: v.profile,
      pixFmt: v.pixFmt,
      width: v.width,
      height: v.height,
      fps: Number(fps.toFixed(3)),
      frames: v.nbFrames,
      bitRate: v.bitRate,
      gif: v.codec === 'gif',
    },
    audio: a && {
      codec: a.codec,
      sampleRate: a.sampleRate,
      channels: a.channels,
      bitRate: a.bitRate,
    },
  };
}
