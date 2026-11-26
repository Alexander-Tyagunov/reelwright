/**
 * @fileoverview The noise cues: whoosh and rise. Both are stereo, with
 * different noise on each side so they feel wide.
 */
import type {StereoBuffer} from './buffer.ts';
import {samplesOf} from './buffer.ts';
import {withPeak} from './cue-sounds.ts';
import {smooth} from './envelope.ts';
import {sweptNoise} from './noise.ts';
import {phaseStep, sineAt, TABLE_SIZE} from './oscillator.ts';
import type {CueSettings} from './palette-types.ts';
import type {Random} from './random.ts';

/** Length of a whoosh in seconds. */
export const WHOOSH_S = 1.1;

/** Peak level of a whoosh at gain 1, linear. */
export const WHOOSH_PEAK = 0.2;

/** Peak level of a rise at gain 1, linear. */
export const RISE_PEAK = 0.17;

/** Seconds a rise keeps ringing out after it peaks. */
export const RISE_TAIL_S = 0.12;

/**
 * A soft swoosh: a band of noise that sweeps up and fades.
 *
 * @param gain Linear level factor, 0 to 1.
 * @returns Two channels of {@link WHOOSH_S} seconds. The loudest point is
 *   at the middle.
 */
export function whooshSound(
  rng: Random,
  gain: number,
  cue: CueSettings,
  rate: number,
): StereoBuffer {
  const [from, to] = cue.whoosh;
  const make = (): Float32Array =>
    withPeak(
      sweptNoise(rng, {
        samples: samplesOf(WHOOSH_S),
        fromHz: from,
        toHz: to,
        q: 1.6,
        peakAt: 0.5,
        rate,
      }),
      WHOOSH_PEAK * gain,
    );
  return {left: make(), right: make()};
}

function glideTone(hz: number, samples: number, rate: number): Float32Array {
  const out = new Float32Array(samples);
  let ph = 0;
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    out[i] = sineAt(ph) * x * x;
    ph = (ph + phaseStep(hz * (1 + x), rate)) % TABLE_SIZE;
  }
  return out;
}

/**
 * A riser: a band of noise and a tone that climb together for `seconds`,
 * then stop with a short tail.
 *
 * @param hz Pitch where the tone starts, in hertz. It ends an octave up.
 * @param seconds Time the rise builds, in seconds.
 * @param gain Linear level factor, 0 to 1.
 * @returns Two channels of `seconds` plus {@link RISE_TAIL_S}.
 */
export function riseSound(
  rng: Random,
  hz: number,
  seconds: number,
  gain: number,
  cue: CueSettings,
  rate: number,
): StereoBuffer {
  const samples = samplesOf(seconds + RISE_TAIL_S);
  const [from, to] = cue.whoosh;
  const peakAt = seconds / (seconds + RISE_TAIL_S);
  const tone = glideTone(hz, samples, rate);
  const make = (): Float32Array => {
    const noise = sweptNoise(rng, {
      samples,
      fromHz: from,
      toHz: to * 1.5,
      q: 2.2,
      peakAt,
      rate,
    });
    for (let i = 0; i < samples; i++) {
      const fade = smooth((samples - i) / (RISE_TAIL_S * rate));
      const rise = (i / samples) ** 2;
      noise[i] = ((noise[i] ?? 0) * rise * 0.8 + (tone[i] ?? 0) * 0.35) * fade;
    }
    return withPeak(noise, RISE_PEAK * gain);
  };
  return {left: make(), right: make()};
}
