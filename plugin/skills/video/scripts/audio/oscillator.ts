/**
 * @fileoverview Sine oscillators that read a shared lookup table. A phase is
 * counted in table steps, so one cycle is {@link TABLE_SIZE} steps.
 */

/** Entries in the sine table. One cycle. */
export const TABLE_SIZE = 16384;

const TABLE_MASK = TABLE_SIZE - 1;

const SINE = new Float32Array(TABLE_SIZE);
for (let i = 0; i < TABLE_SIZE; i++) {
  SINE[i] = Math.sin((2 * Math.PI * i) / TABLE_SIZE);
}

/**
 * Sine of a phase.
 *
 * @param phase Position in table steps. One cycle is 16384 steps. Any
 *   non-negative number works.
 * @returns A value from -1 to 1.
 */
export function sineAt(phase: number): number {
  return SINE[phase & TABLE_MASK] ?? 0;
}

/**
 * Phase step per sample for a frequency.
 *
 * @param hz Frequency in hertz.
 * @param rate Sample rate in samples per second.
 */
export function phaseStep(hz: number, rate: number): number {
  return (hz * TABLE_SIZE) / rate;
}

/** One partial of a tone: a sine at a multiple of the base frequency. */
export interface Partial {
  /** Multiple of the base frequency. */
  ratio: number;
  /** Linear level from 0 to 1. */
  level: number;
  /** Seconds in which this partial falls by 60 dB, or 0 for no decay. */
  decay: number;
}

/**
 * Adds a sine to a signal, sample by sample.
 *
 * @param out Signal that receives the sum.
 * @param hz Frequency in hertz.
 * @param level Linear level of the sine.
 * @param rate Sample rate in samples per second.
 * @param phase Start phase in table steps.
 * @param shape Optional factors that multiply the sine, per sample.
 */
export function addSine(
  out: Float32Array,
  hz: number,
  level: number,
  rate: number,
  phase: number,
  shape?: Float32Array,
): void {
  const step = phaseStep(hz, rate);
  let ph = phase;
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const g = shape ? (shape[i] ?? 0) : 1;
    out[i] = (out[i] ?? 0) + (SINE[ph & TABLE_MASK] ?? 0) * level * g;
    ph += step;
    if (ph >= TABLE_SIZE) {
      ph -= TABLE_SIZE;
    }
  }
}

/**
 * Makes a plucked tone: partials that start together and each fall away at
 * their own rate. The first 2 ms rise from zero, so there is no click.
 *
 * @param hz Base frequency in hertz.
 * @param seconds Length of the signal in seconds.
 * @param partials Partials of the tone.
 * @param rate Sample rate in samples per second.
 * @returns A mono signal with a peak near the sum of the partial levels.
 */
export function pluck(
  hz: number,
  seconds: number,
  partials: readonly Partial[],
  rate: number,
): Float32Array {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  const rise = Math.max(1, Math.round(0.002 * rate));
  for (const p of partials) {
    const f = hz * p.ratio;
    if (f >= rate / 2.2) {
      continue;
    }
    const step = phaseStep(f, rate);
    const k = p.decay > 0 ? 10 ** (-3 / (p.decay * rate)) : 1;
    let ph = 0;
    let env = 1;
    for (let i = 0; i < n; i++) {
      const a = i < rise ? i / rise : 1;
      out[i] = (out[i] ?? 0) + (SINE[ph & TABLE_MASK] ?? 0) * p.level * env * a;
      ph += step;
      if (ph >= TABLE_SIZE) {
        ph -= TABLE_SIZE;
      }
      env *= k;
    }
  }
  return out;
}
