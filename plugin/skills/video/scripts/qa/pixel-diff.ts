/**
 * @fileoverview Compares two screenshots pixel by pixel. Chrome's
 * anti-aliasing leaves a few pixels some levels apart depending on what was
 * painted before; that is invisible and is not a determinism failure. A frame
 * that depends on history, a clock or `Math.random` differs by far more.
 */
import {sha1} from '../core/hash.ts';
import {capture} from '../core/process.ts';
import {DETERMINISM_LEVELS} from './thresholds.ts';

/** Result of a comparison. */
export interface PixelDiff {
  /** Pixels whose largest channel differs by more than 8 levels. */
  pixels: number;
  /** Largest channel difference seen, in levels (0 to 255). */
  max: number;
}

/**
 * Compares two raw RGB images of the same size.
 *
 * @param a Bytes in R, G, B order, 3 per pixel.
 * @returns Infinite pixels when the lengths differ.
 */
export function compareRgb(a: Uint8Array, b: Uint8Array): PixelDiff {
  if (a.length !== b.length) {
    return {pixels: Number.POSITIVE_INFINITY, max: 255};
  }
  let pixels = 0;
  let max = 0;
  for (let i = 0; i + 2 < a.length; i += 3) {
    const d = Math.max(
      Math.abs((a[i] ?? 0) - (b[i] ?? 0)),
      Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)),
      Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0)),
    );
    max = Math.max(max, d);
    if (d > DETERMINISM_LEVELS) {
      pixels++;
    }
  }
  return {pixels, max};
}

function toRgb(png: Buffer): Promise<Buffer> {
  const args = ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe'];
  args.push('-c:v', 'png', '-i', '-', '-frames:v', '1', '-f', 'rawvideo');
  args.push('-pix_fmt', 'rgb24', '-');
  return capture('ffmpeg', args, {input: png});
}

/**
 * Compares two PNG screenshots. Identical bytes return at once.
 *
 * @throws UserError when ffmpeg is missing or cannot read an image.
 */
export async function diffPngs(a: Buffer, b: Buffer): Promise<PixelDiff> {
  if (sha1(a) === sha1(b)) {
    return {pixels: 0, max: 0};
  }
  return compareRgb(await toRgb(a), await toRgb(b));
}
