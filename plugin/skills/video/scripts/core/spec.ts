/**
 * @fileoverview Loading and validating `film.json`, and frame sizes.
 */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {FilmSpec} from '../shared/contract.ts';
import {UserError} from './errors.ts';
import {checkFps, checkSide} from './validate.ts';

/** A film spec read from disk. */
export interface LoadedSpec {
  /** Absolute path of the spec file. */
  abs: string;
  /** Absolute path of the spec's folder: the project folder. */
  dir: string;
  film: FilmSpec;
}

/** Frame size in pixels. */
export interface FrameSize {
  width: number;
  height: number;
}

/**
 * Reads and parses a film spec.
 *
 * @param path Path to `film.json`, absolute or relative to the working
 *   folder.
 * @throws UserError when the path is missing, the file is absent, or the
 *   JSON is invalid.
 */
export function loadSpec(path: string | undefined): LoadedSpec {
  if (!path) {
    throw new UserError('missing film spec path, e.g. film.json');
  }
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new UserError(`film spec not found: ${abs}`);
  }
  let film: unknown;
  try {
    film = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new UserError(`film spec is not valid JSON (${abs}): ${why}`);
  }
  if (typeof film !== 'object' || film === null || Array.isArray(film)) {
    throw new UserError(`film spec must be a JSON object (${abs})`);
  }
  checkMeta(film as FilmSpec);
  return {abs, dir: dirname(abs), film: film as FilmSpec};
}

/** Checks `meta.width`, `meta.height` and `meta.fps` when they are set. */
function checkMeta(film: FilmSpec): void {
  const meta: Record<string, unknown> = {...film.meta};
  if (meta.width !== undefined) {
    checkSide('meta.width', meta.width);
  }
  if (meta.height !== undefined) {
    checkSide('meta.height', meta.height);
  }
  if (meta.fps !== undefined) {
    checkFps('meta.fps', meta.fps);
  }
}

/**
 * Checks that both sides of a frame size are integers from 16 to 8192
 * pixels, and even, as H.264 requires.
 *
 * @throws UserError when a side is odd, fractional or out of range.
 */
export function assertEvenSize(
  size: FrameSize,
  names: readonly [string, string] = ['frame width', 'frame height'],
): FrameSize {
  const text = `${size.width}x${size.height}`;
  for (const side of [size.width, size.height]) {
    if (Number.isInteger(side) && side % 2) {
      throw new UserError(
        `width and height must be even numbers for H.264, got ${text}. ` +
          'Change the odd side by one pixel.',
      );
    }
  }
  checkSide(names[0], size.width);
  checkSide(names[1], size.height);
  return size;
}

/**
 * Parses text such as `1080x1920`.
 *
 * @throws UserError when the text has another shape.
 */
export function parseSize(text: string): FrameSize {
  const m = text.match(/^(\d+)x(\d+)$/);
  if (!m) {
    throw new UserError(`--size must look like 1080x1920, got "${text}"`);
  }
  return {width: Number(m[1]), height: Number(m[2])};
}

/**
 * Chooses the frame size of a film: the override when given, otherwise the
 * spec's `meta.width` and `meta.height`, otherwise 1920x1080.
 *
 * @param override Text from `--size`, such as `1080x1920`.
 * @throws UserError when the text is malformed or a side is odd or outside
 *   16 to 8192 pixels.
 */
export function frameSize(film: FilmSpec, override?: string): FrameSize {
  if (override) {
    const names = ['--size width', '--size height'] as const;
    return assertEvenSize(parseSize(override), names);
  }
  const size = {
    width: film.meta?.width ?? 1920,
    height: film.meta?.height ?? 1080,
  };
  return assertEvenSize(size, ['meta.width', 'meta.height']);
}
