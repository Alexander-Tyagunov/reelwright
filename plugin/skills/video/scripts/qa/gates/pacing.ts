/**
 * @fileoverview The pacing gate: scene lengths, and whether the first and
 * last frames show something. It never fails.
 */
import type {OpenFilm} from '../../browser/film.ts';
import {frameAt} from '../../browser/film.ts';
import {capture} from '../../core/process.ts';
import type {FilmInfo} from '../../shared/contract.ts';
import {r2, r3, sceneLabel} from '../labels.ts';
import type {GateResult} from '../report.ts';
import {findings} from '../report.ts';
import {BLANK_STDDEV, SCENE_MAX_S, SCENE_MIN_S} from '../thresholds.ts';

/** Standard deviation of the grey levels of a 64x36 thumbnail. */
async function thumbnailSpread(jpeg: Buffer): Promise<number> {
  const args = ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe'];
  args.push('-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=64:36,format=gray');
  args.push('-frames:v', '1', '-f', 'rawvideo', '-');
  const raw = await capture('ffmpeg', args, {input: jpeg});
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  const squares = raw.reduce((a, b) => a + (b - mean) ** 2, 0);
  return Math.sqrt(squares / raw.length);
}

/** Warns about scene lengths outside 1.5 s to 12 s. */
export function sceneLengthWarnings(info: FilmInfo): string[] {
  const out: string[] = [];
  for (const s of info.scenes) {
    const label = sceneLabel(info, s.index);
    if (s.duration < SCENE_MIN_S) {
      out.push(`${label}: ${s.duration} s is shorter than ${SCENE_MIN_S} s`);
    }
    if (s.duration > SCENE_MAX_S) {
      out.push(`${label}: ${s.duration} s is longer than ${SCENE_MAX_S} s`);
    }
  }
  return out;
}

/** Spread of the first and last frame, in grey levels. */
export interface EndSpreads {
  first: number;
  last: number;
  /** Film time of the last frame, in seconds. */
  lastAt: number;
}

/**
 * Warns when the first or the last frame is blank. A looping film is blank
 * at both ends by design, so it never warns.
 *
 * @param loop True when the film loops.
 * @param ends Spread of the first and the last frame.
 */
export function blankFrameWarnings(loop: boolean, ends: EndSpreads): string[] {
  if (loop) {
    return [];
  }
  const out: string[] = [];
  if (ends.first < BLANK_STDDEV) {
    out.push(
      `frame 0 is blank: the thumbnail will be empty, export with --poster ` +
        `(thumbnail stddev ${r2(ends.first)}, need >= ${BLANK_STDDEV})`,
    );
  }
  if (ends.last < BLANK_STDDEV) {
    out.push(
      `last frame (t=${r3(ends.lastAt)}s) is blank (thumbnail stddev ` +
        `${r2(ends.last)}, need >= ${BLANK_STDDEV})`,
    );
  }
  return out;
}

/**
 * Checks scene lengths, then draws the first and the last frame and warns
 * when either is blank. A looping film skips the frame checks.
 */
export async function gatePacing(film: OpenFilm): Promise<GateResult> {
  const {info, page} = film;
  const result = findings();
  for (const text of sceneLengthWarnings(info)) {
    result.add('WARN', text);
  }
  const lengths = info.scenes.map(s => s.duration);
  const range = `${Math.min(...lengths)}-${Math.max(...lengths)}`;
  if (info.loop) {
    return {
      id: 'pacing',
      status: result.status,
      summary: `scenes ${range} s; loop, blank ends are by design`,
      details: result.details,
    };
  }
  const lastAt = (info.frames - 1) / info.fps;
  const first = await thumbnailSpread(await frameAt(page, 0));
  const last = await thumbnailSpread(await frameAt(page, lastAt));
  for (const text of blankFrameWarnings(false, {first, last, lastAt})) {
    result.add('WARN', text);
  }
  return {
    id: 'pacing',
    status: result.status,
    summary:
      `scenes ${range} s; frame 0 stddev ${r2(first)}, ` +
      `last frame stddev ${r2(last)}`,
    details: result.details,
  };
}
