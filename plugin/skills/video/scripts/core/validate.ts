/**
 * @fileoverview Bounded checks for numeric options and spec fields. Each
 * failure is a `UserError` that names the option, the value given and the
 * allowed range.
 */
import {UserError} from './errors.ts';

/** Smallest frame side in pixels. */
export const MIN_SIDE_PX = 16;

/** Largest frame side in pixels. */
export const MAX_SIDE_PX = 8192;

/** Lowest accepted frame rate, in frames per second. */
export const MIN_FPS = 1;

/** Highest accepted frame rate, in frames per second. */
export const MAX_FPS = 120;

/** Highest TCP port number. */
export const MAX_PORT = 65535;

/** Kinds of number that {@link checkRange} accepts. */
export type NumberKind = 'number' | 'integer' | 'even integer';

function show(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

/**
 * Checks that a value is a number of the given kind within a range.
 *
 * @param label The option or field, for example `--port` or `meta.fps`.
 * @param min Lowest allowed value, inclusive.
 * @param max Highest allowed value, inclusive.
 * @returns The value, as a number.
 * @throws UserError naming the label, the value and the allowed range.
 */
export function checkRange(
  label: string,
  value: unknown,
  min: number,
  max: number,
  kind: NumberKind = 'number',
): number {
  const ok =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (kind === 'number' || Number.isInteger(value)) &&
    (kind !== 'even integer' || value % 2 === 0);
  if (!ok) {
    const article = kind === 'number' ? 'a number' : `an ${kind}`;
    throw new UserError(
      `${label} must be ${article} from ${min} to ${max}, got ${show(value)}`,
    );
  }
  return value;
}

/**
 * Checks that a value is a number greater than zero.
 *
 * @throws UserError naming the label and the value.
 */
export function checkPositive(label: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new UserError(
      `${label} must be a number greater than 0, got ${show(value)}`,
    );
  }
  return value;
}

/** Checks one frame side: an even integer from 16 to 8192 pixels. */
export function checkSide(label: string, value: unknown): number {
  return checkRange(label, value, MIN_SIDE_PX, MAX_SIDE_PX, 'even integer');
}

/** Checks a frame rate: a number from 1 to 120 frames per second. */
export function checkFps(label: string, value: unknown): number {
  return checkRange(label, value, MIN_FPS, MAX_FPS);
}

/** Checks a TCP port: an integer from 0 to 65535. 0 picks a free port. */
export function checkPort(label: string, value: unknown): number {
  return checkRange(label, value, 0, MAX_PORT, 'integer');
}
