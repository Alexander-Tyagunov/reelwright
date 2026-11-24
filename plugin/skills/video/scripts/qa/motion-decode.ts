/**
 * @fileoverview Decodes a video to small grey frames through ffmpeg and
 * measures how much each frame differs from the one before.
 */
import {spawn} from 'node:child_process';
import {UserError} from '../core/errors.ts';
import {MOTION_HEIGHT, MOTION_WIDTH} from './thresholds.ts';

/** What {@link decodeMotion} returns. */
export interface DecodedMotion {
  /** Mean absolute difference in grey levels. Index 0 is unused (0). */
  diffs: number[];
  /** Number of frames decoded. */
  count: number;
  /** Difference between the last and the first frame, in grey levels. */
  seam: number;
}

const FRAME_BYTES = MOTION_WIDTH * MOTION_HEIGHT;

/**
 * Mean absolute difference between two grey frames of equal length.
 *
 * @returns Grey levels, 0 to 255.
 */
export function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < FRAME_BYTES; i++) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return sum / FRAME_BYTES;
}

/** Collects raw grey frames from chunks and measures their differences. */
function frameReader() {
  const diffs = [0];
  let pending: Buffer = Buffer.alloc(0);
  let first: Uint8Array | null = null;
  let previous: Uint8Array | null = null;
  return {
    push(chunk: Buffer): void {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      let offset = 0;
      while (pending.length - offset >= FRAME_BYTES) {
        const raw = pending.subarray(offset, offset + FRAME_BYTES);
        const frame = Uint8Array.from(raw);
        offset += FRAME_BYTES;
        if (previous) {
          diffs.push(meanAbsDiff(previous, frame));
        } else {
          first = frame;
        }
        previous = frame;
      }
      pending = pending.subarray(offset);
    },
    result(): DecodedMotion {
      const seam = first && previous ? meanAbsDiff(first, previous) : 0;
      return {diffs, count: first ? diffs.length : 0, seam};
    },
  };
}

/**
 * Decodes every frame to 160x90 grey and returns the consecutive differences.
 *
 * @param path Video file.
 * @throws UserError when ffmpeg cannot start or fails.
 */
export function decodeMotion(path: string): Promise<DecodedMotion> {
  const filter = `scale=${MOTION_WIDTH}:${MOTION_HEIGHT}:flags=area,format=gray`;
  const args = ['-hide_banner', '-loglevel', 'error', '-i', path, '-an'];
  args.push('-vf', filter, '-f', 'rawvideo', '-');
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, {stdio: ['ignore', 'pipe', 'pipe']});
    const reader = frameReader();
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.stdout.on('data', (chunk: Buffer) => reader.push(chunk));
    child.on('error', e =>
      reject(new UserError(`could not run ffmpeg: ${e.message}`)),
    );
    child.on('close', code => {
      if (code === 0) {
        resolve(reader.result());
        return;
      }
      reject(
        new UserError(`ffmpeg decode failed (${code}): ${stderr.slice(-500)}`),
      );
    });
  });
}
