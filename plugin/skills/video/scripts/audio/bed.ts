/**
 * @fileoverview The bed: pad and pulse for a whole film, shaped by the
 * intensity curve. Low intensity means a lower level and a thinner pad;
 * high intensity adds the upper partials and the pulse.
 */
import type {StereoBuffer} from './buffer.ts';
import {createBuffer, samplesOf} from './buffer.ts';
import {planChords} from './chords.ts';
import type {CurvePoint} from './envelope.ts';
import {curveAt, curveSamples} from './envelope.ts';
import {renderPad} from './pad.ts';
import type {Palette} from './palette-types.ts';
import {addPulse} from './pulse.ts';
import {createRandom, derivedSeed} from './random.ts';

/** Share of the full level that the bed keeps at intensity 0. */
const QUIET_LEVEL = 0.18;

/** Stream number of the pad in the seed mix. */
const PAD_STREAM = 1;

/** Everything the bed depends on. */
export interface BedOptions {
  palette: Palette;
  /** Root note name. */
  key: string;
  /** Beats per minute. */
  tempo: number;
  /** Track seed. */
  seed: number;
  /** Film length in seconds. */
  duration: number;
  /** Intensity points, sorted by film time in seconds. */
  intensity: readonly CurvePoint[];
  /** Sample rate in samples per second. */
  rate: number;
}

/**
 * Renders the bed.
 *
 * @returns A buffer of exactly `duration` seconds at the given rate, with
 *   its peak below about 0.3 before limiting.
 */
export function renderBed(o: BedOptions): StereoBuffer {
  const samples = samplesOf(o.duration);
  const spans = planChords(o.duration, o.palette, o.tempo);
  const rng = createRandom(derivedSeed(o.seed, PAD_STREAM));
  const pad = renderPad(spans, o.palette, o.key, samples, rng, o.rate);
  const level = curveSamples(o.intensity, samples, o.rate);
  const out = createBuffer(samples);
  for (const side of ['left', 'right'] as const) {
    const dst = out[side];
    for (let i = 0; i < samples; i++) {
      const x = level[i] ?? 0;
      const gain = QUIET_LEVEL + (1 - QUIET_LEVEL) * x;
      dst[i] =
        ((pad.body[side][i] ?? 0) + (pad.air[side][i] ?? 0) * x * x) * gain;
    }
  }
  addPulse(out, {
    palette: o.palette,
    key: o.key,
    tempo: o.tempo,
    spans,
    duration: o.duration,
    intensityAt: t => curveAt(o.intensity, t),
    rate: o.rate,
  });
  return out;
}
