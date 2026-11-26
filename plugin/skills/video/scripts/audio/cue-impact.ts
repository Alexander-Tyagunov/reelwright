/**
 * @fileoverview The impact cues: hit and boom. A low sine thump that drops
 * in pitch, a short burst of noise, and for a boom a long low rumble.
 */

import {withPeak} from './cue-sounds.ts';
import {smooth} from './envelope.ts';
import {lowpass} from './filter.ts';
import {rumble, whiteNoise} from './noise.ts';
import {phaseStep, sineAt, TABLE_SIZE} from './oscillator.ts';
import type {CueSettings} from './palette-types.ts';
import type {Random} from './random.ts';

/** Peak level of an impact at gain 1 and impact level 1, linear. */
export const IMPACT_PEAK = 0.35;

/** Pitch of the thump at its start, as a multiple of its end pitch. */
const DROP = 2.4;

/** Seconds the pitch of the thump takes to drop. */
const DROP_S = 0.07;

function thump(hz: number, seconds: number, decay: number, rate: number) {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = hz * (1 + (DROP - 1) * Math.exp(-t / (DROP_S / 3)));
    const rise = smooth(i / (0.003 * rate));
    out[i] = sineAt(ph) * Math.exp((-6.9 * t) / decay) * rise;
    ph = (ph + phaseStep(f, rate)) % TABLE_SIZE;
  }
  return out;
}

function burst(rng: Random, seconds: number, hz: number, rate: number) {
  const n = Math.round(seconds * rate);
  const out = whiteNoise(rng, n);
  lowpass(out, hz, rate);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const rise = smooth(i / (0.001 * rate));
    out[i] = (out[i] ?? 0) * Math.exp((-6.9 * t) / (seconds / 3)) * rise;
  }
  return out;
}

function addInto(dst: Float32Array, src: Float32Array, gain: number): void {
  for (let i = 0; i < src.length && i < dst.length; i++) {
    dst[i] = (dst[i] ?? 0) + (src[i] ?? 0) * gain;
  }
}

/**
 * A low impact: a sine thump with a short noise burst on top.
 *
 * @param hz Pitch of the thump at rest, in hertz (a note of the key).
 * @param gain Linear level factor, 0 to 1.
 * @returns A mono signal of about 1.2 seconds.
 */
export function hitSound(
  rng: Random,
  hz: number,
  gain: number,
  cue: CueSettings,
  rate: number,
): Float32Array {
  const out = thump(hz, 1.2, 0.4, rate);
  addInto(out, burst(rng, 0.12, 1800, rate), 0.5);
  return withPeak(out, IMPACT_PEAK * cue.impactLevel * gain);
}

/**
 * A large impact: a long thump, a wide burst and a rumble that rings out.
 *
 * @param hz Pitch of the thump at rest, in hertz.
 * @param gain Linear level factor, 0 to 1.
 * @returns A mono signal as long as the palette's `boomSeconds`.
 */
export function boomSound(
  rng: Random,
  hz: number,
  gain: number,
  cue: CueSettings,
  rate: number,
): Float32Array {
  const seconds = cue.boomSeconds;
  const out = thump(hz, seconds, seconds * 0.5, rate);
  addInto(out, burst(rng, 0.25, 3200, rate), 0.45);
  const tail = rumble(
    rng,
    Math.round(seconds * rate),
    240,
    seconds * 0.8,
    rate,
  );
  addInto(out, tail, 0.35);
  const rise = Math.round(0.004 * rate);
  for (let i = 0; i < rise; i++) {
    out[i] = (out[i] ?? 0) * (i / rise);
  }
  return withPeak(out, IMPACT_PEAK * cue.impactLevel * gain * 1.15);
}
