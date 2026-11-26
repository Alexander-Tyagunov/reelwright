/**
 * @fileoverview Amplitude envelopes. All times are in seconds, all gains are
 * linear factors from 0 to 1.
 */

/** Smooth step from 0 to 1 for `x` from 0 to 1. Flat at both ends. */
export function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/**
 * Fills a signal with a rise, a hold and a fall.
 *
 * @param samples Length of the envelope in samples.
 * @param rise Seconds to rise from 0 to 1. 0 starts at 1.
 * @param fall Seconds to fall from 1 to 0 at the end. 0 ends at 1.
 * @param rate Sample rate in samples per second.
 * @returns Gains with smooth edges.
 */
export function riseFall(
  samples: number,
  rise: number,
  fall: number,
  rate: number,
): Float32Array {
  const out = new Float32Array(samples);
  const up = Math.max(1, rise * rate);
  const down = Math.max(1, fall * rate);
  for (let i = 0; i < samples; i++) {
    const a = rise > 0 ? smooth(i / up) : 1;
    const b = fall > 0 ? smooth((samples - 1 - i) / down) : 1;
    out[i] = a * b;
  }
  return out;
}

/**
 * Multiplies a signal by a fade-in at its start and a fade-out at its end.
 * The first and last samples become exactly zero when a fade is on.
 *
 * @param data Signal, changed in place.
 * @param fadeIn Seconds of fade-in. 0 for none.
 * @param fadeOut Seconds of fade-out. 0 for none.
 * @param rate Sample rate in samples per second.
 */
export function fadeEnds(
  data: Float32Array,
  fadeIn: number,
  fadeOut: number,
  rate: number,
): void {
  const n = data.length;
  const up = Math.max(1, fadeIn * rate);
  const down = Math.max(1, fadeOut * rate);
  const inEnd = fadeIn > 0 ? Math.min(n, Math.ceil(up)) : 0;
  for (let i = 0; i < inEnd; i++) {
    data[i] = (data[i] ?? 0) * smooth(i / up);
  }
  const outStart = fadeOut > 0 ? Math.max(0, n - Math.ceil(down) - 1) : n;
  for (let i = outStart; i < n; i++) {
    data[i] = (data[i] ?? 0) * smooth((n - 1 - i) / down);
  }
}

/** One point of a piecewise-linear curve. */
export interface CurvePoint {
  /** Seconds from the start of the film. */
  at: number;
  /** Value at that time. */
  value: number;
}

/**
 * Value of a piecewise-linear curve. Before the first point and after the
 * last point the curve stays at that point's value.
 *
 * @param points Points sorted by `at`. Must not be empty.
 * @param t Seconds from the start of the film.
 */
export function curveAt(points: readonly CurvePoint[], t: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return 0;
  }
  if (t <= first.at) {
    return first.value;
  }
  if (t >= last.at) {
    return last.value;
  }
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    const a = points[i - 1];
    if (a && b && t <= b.at) {
      const span = b.at - a.at;
      return span > 0
        ? a.value + ((b.value - a.value) * (t - a.at)) / span
        : b.value;
    }
  }
  return last.value;
}

/**
 * Samples a curve once per sample into a gain array.
 *
 * @param points Curve points, see {@link curveAt}.
 * @param samples Length of the result in samples.
 * @param rate Sample rate in samples per second.
 */
export function curveSamples(
  points: readonly CurvePoint[],
  samples: number,
  rate: number,
): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = curveAt(points, i / rate);
  }
  return out;
}
