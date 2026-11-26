/**
 * @fileoverview A soft limiter. Quiet samples pass unchanged; louder ones
 * bend smoothly toward a ceiling that no sample can pass.
 */
import type {StereoBuffer} from './buffer.ts';
import {dbToGain} from './buffer.ts';

/** Fraction of the ceiling below which samples pass unchanged. */
const KNEE = 0.6;

/**
 * Limits one signal in place.
 *
 * @param data Signal, changed in place.
 * @param ceiling Linear level that no sample reaches.
 */
export function softLimit(data: Float32Array, ceiling: number): void {
  const knee = ceiling * KNEE;
  const room = ceiling - knee;
  for (let i = 0; i < data.length; i++) {
    const x = data[i] ?? 0;
    const a = Math.abs(x);
    if (a > knee) {
      const y = knee + room * Math.tanh((a - knee) / room);
      data[i] = x < 0 ? -y : y;
    }
  }
}

/**
 * Limits both channels of a buffer in place.
 *
 * @param ceilingDb Highest level in dBFS, for example -2. Samples stay
 *   below it.
 */
export function limitBuffer(buf: StereoBuffer, ceilingDb: number): void {
  const ceiling = dbToGain(ceilingDb);
  softLimit(buf.left, ceiling);
  softLimit(buf.right, ceiling);
}
