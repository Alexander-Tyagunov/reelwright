/**
 * @fileoverview Mean brightness of every frame of a picture source, read
 * through ffmpeg at a small size. The source is a video file or a numbered
 * image sequence.
 */
import {capture} from '../core/process.ts';

/** Pixels. Width of the grey frames whose brightness is measured. */
export const BRIGHTNESS_WIDTH = 160;

/** Pixels. Height of the grey frames whose brightness is measured. */
export const BRIGHTNESS_HEIGHT = 90;

/** Mean brightness of each frame, in grey levels from 0 to 255. */
export interface FrameBrightness {
  /** Mean of the whole frame, one value per frame. */
  whole: number[];
  /** Mean of the lower third of the frame, one value per frame. */
  lower: number[];
}

const FRAME_BYTES = BRIGHTNESS_WIDTH * BRIGHTNESS_HEIGHT;
const LOWER_START = Math.floor((BRIGHTNESS_HEIGHT * 2) / 3) * BRIGHTNESS_WIDTH;

/**
 * Splits raw grey frames and averages each one.
 *
 * @param raw Frames of 160x90 grey bytes, one after the other.
 */
export function measureFrames(raw: Uint8Array): FrameBrightness {
  const out: FrameBrightness = {whole: [], lower: []};
  for (let at = 0; at + FRAME_BYTES <= raw.length; at += FRAME_BYTES) {
    let all = 0;
    let low = 0;
    for (let i = 0; i < FRAME_BYTES; i++) {
      const v = raw[at + i] ?? 0;
      all += v;
      if (i >= LOWER_START) {
        low += v;
      }
    }
    out.whole.push(all / FRAME_BYTES);
    out.lower.push(low / (FRAME_BYTES - LOWER_START));
  }
  return out;
}

/**
 * Decodes a source to small grey frames and measures each.
 *
 * @param input ffmpeg arguments that name the source, for example
 *   `['-i', 'out/film.mp4']` or `['-start_number', '1', '-i',
 *   'frames/%04d.jpg']`.
 * @throws UserError when ffmpeg cannot start or exits with an error.
 */
export async function frameBrightness(
  input: readonly string[],
): Promise<FrameBrightness> {
  const size = `${BRIGHTNESS_WIDTH}:${BRIGHTNESS_HEIGHT}`;
  const args = ['-hide_banner', '-loglevel', 'error', ...input, '-an'];
  args.push('-vf', `scale=${size}:flags=area,format=gray`);
  args.push('-f', 'rawvideo', '-');
  return measureFrames(await capture('ffmpeg', args));
}
