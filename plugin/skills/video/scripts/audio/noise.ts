/**
 * @fileoverview Noise sources and noise shapes built from them: white noise,
 * a sweeping band, and a low rumble. Lengths are in samples.
 */
import {smooth} from './envelope.ts';
import {lowpass, sweepBandpass} from './filter.ts';
import type {Random} from './random.ts';

/**
 * White noise.
 *
 * @param rng Seeded generator.
 * @param samples Length in samples.
 * @returns Samples from -1 to 1.
 */
export function whiteNoise(rng: Random, samples: number): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = rng.signed();
  }
  return out;
}

/** Shape of a swept noise burst. */
export interface SweepOptions {
  /** Length in samples. */
  samples: number;
  /** Band centre at the start, in hertz. */
  fromHz: number;
  /** Band centre at the end, in hertz. */
  toHz: number;
  /** Sharpness of the band, 1 wide to 8 narrow. */
  q: number;
  /** Position of the loudest point, from 0 (start) to 1 (end). */
  peakAt: number;
  /** Sample rate in samples per second. */
  rate: number;
}

/**
 * Noise through a moving band with a swell shape: it rises to the loudest
 * point at `peakAt` and falls away again. It starts and ends at zero.
 *
 * @returns A mono signal with a peak near 1 before scaling.
 */
export function sweptNoise(rng: Random, o: SweepOptions): Float32Array {
  const out = whiteNoise(rng, o.samples);
  sweepBandpass(out, o.fromHz, o.toHz, o.q, o.rate);
  const peak = Math.max(1, Math.round(o.samples * o.peakAt));
  const tail = Math.max(1, o.samples - peak);
  let top = 1e-9;
  for (let i = 0; i < o.samples; i++) {
    const g =
      i < peak ? smooth(i / peak) ** 1.5 : smooth((o.samples - i) / tail);
    out[i] = (out[i] ?? 0) * g;
    top = Math.max(top, Math.abs(out[i] ?? 0));
  }
  for (let i = 0; i < o.samples; i++) {
    out[i] = (out[i] ?? 0) / top;
  }
  return out;
}

/**
 * Low noise for the body of an impact: white noise through a low-pass
 * filter, with an exponential fall.
 *
 * @param hz Low-pass cutoff in hertz.
 * @param decay Seconds in which the level falls by 60 dB.
 * @returns A mono signal that starts at full level and falls.
 */
export function rumble(
  rng: Random,
  samples: number,
  hz: number,
  decay: number,
  rate: number,
): Float32Array {
  const out = whiteNoise(rng, samples);
  lowpass(out, hz, rate);
  const k = 10 ** (-3 / (decay * rate));
  let env = 1;
  let top = 1e-9;
  for (let i = 0; i < samples; i++) {
    out[i] = (out[i] ?? 0) * env;
    env *= k;
    top = Math.max(top, Math.abs(out[i] ?? 0));
  }
  for (let i = 0; i < samples; i++) {
    out[i] = (out[i] ?? 0) / top;
  }
  return out;
}
