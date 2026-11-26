/**
 * @fileoverview Filters. Cutoffs and centres are in hertz, signals are
 * changed in place.
 */

/** Samples between two coefficient updates of a sweeping filter. */
const SWEEP_BLOCK = 64;

/**
 * One-pole low-pass filter, applied twice for a gentle 12 dB per octave
 * slope.
 *
 * @param data Signal, changed in place.
 * @param hz Cutoff in hertz.
 * @param rate Sample rate in samples per second.
 */
export function lowpass(data: Float32Array, hz: number, rate: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / rate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 += a * ((data[i] ?? 0) - s1);
    s2 += a * (s1 - s2);
    data[i] = s2;
  }
}

/**
 * One-pole high-pass filter. It removes any constant offset and rumble.
 *
 * @param data Signal, changed in place.
 * @param hz Cutoff in hertz.
 * @param rate Sample rate in samples per second.
 */
export function highpass(data: Float32Array, hz: number, rate: number): void {
  const a = Math.exp((-2 * Math.PI * hz) / rate);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i] ?? 0;
    prevOut = a * (prevOut + x - prevIn);
    prevIn = x;
    data[i] = prevOut;
  }
}

/**
 * Band-pass filter whose centre moves along a curve. The centre goes from
 * `fromHz` to `toHz` on a logarithmic path, so equal steps sound equal.
 *
 * @param data Signal, changed in place.
 * @param fromHz Centre at the first sample, in hertz.
 * @param toHz Centre at the last sample, in hertz.
 * @param q Sharpness of the band. 1 is wide, 8 is narrow.
 * @param rate Sample rate in samples per second.
 */
export function sweepBandpass(
  data: Float32Array,
  fromHz: number,
  toHz: number,
  q: number,
  rate: number,
): void {
  const n = data.length;
  const damp = 1 / q;
  const ratio = toHz / fromHz;
  let low = 0;
  let band = 0;
  let f = 0;
  for (let i = 0; i < n; i++) {
    if (i % SWEEP_BLOCK === 0) {
      const hz = fromHz * ratio ** (i / Math.max(1, n - 1));
      f = 2 * Math.sin((Math.PI * Math.min(hz, rate / 6)) / rate);
    }
    const x = data[i] ?? 0;
    low += f * band;
    const high = x - low - damp * band;
    band += f * high;
    data[i] = band;
  }
}
