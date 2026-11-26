/**
 * @fileoverview The sounds of the pitched cues: tick, chime, pop and sting.
 * Each function returns a mono signal with a given peak, in linear level.
 */
import {smooth} from './envelope.ts';
import type {Partial} from './oscillator.ts';
import {phaseStep, pluck, sineAt, TABLE_SIZE} from './oscillator.ts';
import type {CueSettings} from './palette-types.ts';

/** Peak level of a tick at gain 1, linear. */
export const TICK_PEAK = 0.16;

/** Peak level of a chime at gain 1, linear. */
export const CHIME_PEAK = 0.2;

/** Peak level of a pop at gain 1, linear. */
export const POP_PEAK = 0.18;

/** Peak level of a sting at gain 1, linear. */
export const STING_PEAK = 0.2;

/** Seconds between the notes of a sting. */
const STING_STEP_S = 0.11;

/** Scales a signal so that its largest sample has the given level. */
export function withPeak(data: Float32Array, peak: number): Float32Array {
  let top = 1e-9;
  for (let i = 0; i < data.length; i++) {
    top = Math.max(top, Math.abs(data[i] ?? 0));
  }
  const k = peak / top;
  for (let i = 0; i < data.length; i++) {
    data[i] = (data[i] ?? 0) * k;
  }
  return data;
}

function partials(cue: CueSettings, decay: number): Partial[] {
  return cue.ratios.map((ratio, i) => ({
    ratio,
    level: cue.levels[i] ?? 0,
    decay: decay / Math.sqrt(ratio),
  }));
}

/**
 * A short plucked note.
 *
 * @param hz Pitch in hertz.
 * @param gain Linear level factor, 0 to 1.
 */
export function tickSound(
  hz: number,
  gain: number,
  cue: CueSettings,
  rate: number,
): Float32Array {
  const seconds = Math.min(1.6, cue.tickDecay * 1.4);
  const note = pluck(hz, seconds, partials(cue, cue.tickDecay), rate);
  return withPeak(note, TICK_PEAK * gain);
}

/**
 * A ringing bell-like note.
 *
 * @param hz Pitch in hertz.
 * @param gain Linear level factor, 0 to 1.
 */
export function chimeSound(
  hz: number,
  gain: number,
  cue: CueSettings,
  rate: number,
): Float32Array {
  const seconds = Math.min(3.2, cue.chimeDecay * 1.1);
  const note = pluck(hz, seconds, partials(cue, cue.chimeDecay), rate);
  return withPeak(note, CHIME_PEAK * gain);
}

/**
 * A light blip whose pitch slides up a minor third in 40 ms.
 *
 * @param hz Pitch in hertz where the slide ends.
 * @param gain Linear level factor, 0 to 1.
 */
export function popSound(hz: number, gain: number, rate: number): Float32Array {
  const n = Math.round(0.2 * rate);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = hz * (0.84 + 0.16 * smooth(t / 0.04));
    const env = Math.exp(-t / 0.045) * smooth(i / (0.002 * rate));
    out[i] = (sineAt(ph) + 0.25 * sineAt(ph * 2)) * env;
    ph = (ph + phaseStep(f, rate)) % TABLE_SIZE;
  }
  return withPeak(out, POP_PEAK * gain);
}

/**
 * A short rising accent of three plucked notes from the scale.
 *
 * @param hzs Three pitches in hertz, lowest first.
 * @param gain Linear level factor, 0 to 1.
 */
export function stingSound(
  hzs: readonly number[],
  gain: number,
  cue: CueSettings,
  rate: number,
): Float32Array {
  const total = STING_STEP_S * (hzs.length - 1) + 1.6;
  const out = new Float32Array(Math.round(total * rate));
  hzs.forEach((hz, i) => {
    const last = i === hzs.length - 1;
    const decay = last ? cue.chimeDecay * 0.6 : cue.tickDecay;
    const note = pluck(hz, last ? 1.6 : 0.5, partials(cue, decay), rate);
    const from = Math.round(i * STING_STEP_S * rate);
    for (let k = 0; k < note.length && from + k < out.length; k++) {
      out[from + k] = (out[from + k] ?? 0) + (note[k] ?? 0);
    }
  });
  return withPeak(out, STING_PEAK * gain);
}
