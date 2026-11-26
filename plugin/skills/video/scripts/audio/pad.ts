/**
 * @fileoverview The pad: slow chords made of detuned sine partials. The low
 * partials form the `body`; the upper ones form the `air`, which swells
 * and fades slowly. Keeping them apart lets the intensity curve thin out
 * the air first.
 */
import type {StereoBuffer} from './buffer.ts';
import {createBuffer} from './buffer.ts';
import type {ChordSpan} from './chords.ts';
import {riseFall} from './envelope.ts';
import {lowpass} from './filter.ts';
import {addSine, TABLE_SIZE} from './oscillator.ts';
import type {Palette} from './palette-types.ts';
import type {Random} from './random.ts';
import {degreeHz} from './scale.ts';

/** Linear level of one note of the pad before mixing. */
export const NOTE_LEVEL = 0.05;

/** Root-mean-square level of the pad at full intensity, linear. */
export const PAD_RMS = 0.06;

/** Level of the detuned copy in each channel against the shared note. */
const SIDE_LEVEL = 0.3;

/** Partials below this index go to the body, the rest to the air. */
const BODY_PARTIALS = 2;

/** Seconds of the first fade-in. */
const FIRST_RISE_S = 0.8;

/** Seconds the closing chord takes to fall at the very end. */
const LAST_FALL_S = 0.25;

/** The pad in two layers. */
export interface PadLayers {
  body: StereoBuffer;
  air: StereoBuffer;
}

interface Voice {
  hz: number;
  level: number;
}

function chordVoices(span: ChordSpan, p: Palette, key: string): Voice[] {
  const {pad, scale} = p;
  const voices = pad.stack.map(step => ({
    hz: degreeHz(key, scale, span.degree + step, pad.octave),
    level: NOTE_LEVEL,
  }));
  voices.push({
    hz: degreeHz(key, scale, span.degree, pad.octave - 1),
    level: NOTE_LEVEL * pad.bass,
  });
  return voices;
}

function airShape(
  env: Float32Array,
  lfoHz: number,
  phase: number,
  rate: number,
) {
  const out = new Float32Array(env.length);
  const w = (2 * Math.PI * lfoHz) / rate;
  for (let i = 0; i < out.length; i++) {
    const swell = 0.5 + 0.5 * Math.sin(phase + w * i);
    out[i] = (env[i] ?? 0) * (0.3 + 0.7 * swell);
  }
  return out;
}

function addVoice(
  layers: PadLayers,
  v: Voice,
  from: number,
  shapes: {body: Float32Array; air: Float32Array},
  p: Palette,
  rng: Random,
  rate: number,
): void {
  const spread = 2 ** (p.pad.detuneCents / 2400);
  const phase = rng.next() * TABLE_SIZE;
  p.pad.harmonics.forEach((amp, h) => {
    const air = h >= BODY_PARTIALS;
    const target = air ? layers.air : layers.body;
    const shape = air ? shapes.air : shapes.body;
    const level = v.level * amp;
    const hz = v.hz * (h + 1);
    const to = from + shape.length;
    for (const side of [target.left, target.right]) {
      addSine(side.subarray(from, to), hz, level, rate, phase, shape);
    }
    const wide = level * SIDE_LEVEL;
    const l = target.left.subarray(from, to);
    const r = target.right.subarray(from, to);
    addSine(l, hz / spread, wide, rate, phase + 311, shape);
    addSine(r, hz * spread, wide, rate, phase + 977, shape);
  });
}

/**
 * Renders the chord plan as a pad.
 *
 * @param spans Chord plan, see `planChords`.
 * @param key Root note name.
 * @param samples Length of both layers in samples.
 * @returns Both layers, not yet filtered, with a peak below about 0.2.
 */
export function renderPad(
  spans: readonly ChordSpan[],
  p: Palette,
  key: string,
  samples: number,
  rng: Random,
  rate: number,
): PadLayers {
  const layers = {body: createBuffer(samples), air: createBuffer(samples)};
  for (const span of spans) {
    const len = span.end - span.start;
    const xf = Math.min(p.pad.attack, len / 2);
    const from = span.first
      ? 0
      : Math.max(0, Math.round((span.start - xf) * rate));
    const to = span.last
      ? samples
      : Math.min(samples, Math.round((span.end + xf) * rate));
    const rise = span.first ? Math.min(FIRST_RISE_S, p.pad.attack) : 2 * xf;
    const fall = span.last ? LAST_FALL_S : 2 * xf;
    const body = riseFall(to - from, rise, fall, rate);
    const air = airShape(body, p.pad.lfoHz, rng.next() * 6.28, rate);
    for (const v of chordVoices(span, p, key)) {
      addVoice(layers, v, from, {body, air}, p, rng, rate);
    }
  }
  for (const layer of [layers.body, layers.air]) {
    lowpass(layer.left, p.pad.cutoffHz, rate);
    lowpass(layer.right, p.pad.cutoffHz, rate);
  }
  scaleToRms(layers, PAD_RMS);
  return layers;
}

function scaleToRms(layers: PadLayers, target: number): void {
  let sum = 0;
  for (const side of ['left', 'right'] as const) {
    const a = layers.body[side];
    const b = layers.air[side];
    for (let i = 0; i < a.length; i++) {
      const v = (a[i] ?? 0) + (b[i] ?? 0);
      sum += v * v;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, 2 * layers.body.left.length));
  const k = rms > 0 ? target / rms : 1;
  for (const layer of [layers.body, layers.air]) {
    for (const ch of [layer.left, layer.right]) {
      for (let i = 0; i < ch.length; i++) {
        ch[i] = (ch[i] ?? 0) * k;
      }
    }
  }
}
