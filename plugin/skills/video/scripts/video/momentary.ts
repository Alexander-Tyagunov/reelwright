/**
 * @fileoverview Momentary loudness of a file over time, read from the
 * ebur128 filter. Levels are in LUFS, times in seconds.
 */
import {run} from '../core/process.ts';

/** Momentary loudness at one moment. */
export interface MomentaryPoint {
  /** Seconds from the start of the file. */
  t: number;
  /** Loudness over the last 0.4 s, in LUFS. */
  lufs: number;
}

/** LUFS at or below which a reading is silence and is left out. */
const SILENCE_LUFS = -120;

const LINE = /t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+)/g;

/**
 * Parses the log of the ebur128 filter.
 *
 * @param log Text that ffmpeg wrote on its error output.
 * @returns Readings in time order, without the silent ones.
 */
export function parseMomentary(log: string): MomentaryPoint[] {
  const points: MomentaryPoint[] = [];
  for (const m of log.matchAll(LINE)) {
    const lufs = Number(m[2]);
    if (lufs > SILENCE_LUFS) {
      points.push({t: Number(m[1]), lufs});
    }
  }
  return points;
}

/**
 * Measures the momentary loudness of a file's audio, about ten times a
 * second.
 *
 * @returns Readings, or an empty list when the file has no audio.
 * @throws UserError when ffmpeg cannot start.
 */
export async function momentaryLoudness(
  file: string,
): Promise<MomentaryPoint[]> {
  const args = ['-hide_banner', '-nostats', '-i', file, '-vn'];
  args.push('-af', 'ebur128', '-f', 'null', '-');
  const r = await run('ffmpeg', args, {allowFail: true});
  return parseMomentary(r.stderr);
}
