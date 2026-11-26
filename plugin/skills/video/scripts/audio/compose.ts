/**
 * @fileoverview Builds the whole track of a film: bed, cues, echo, reverb,
 * fades and the limiter. The result depends only on the plan, so the same
 * plan gives the same samples.
 */
import {renderBed} from './bed.ts';
import type {StereoBuffer} from './buffer.ts';
import {addBuffer, createBuffer, SAMPLE_RATE, samplesOf} from './buffer.ts';
import {finalLength} from './chords.ts';
import {mixCues} from './cue-mixer.ts';
import type {Cue} from './cues.ts';
import type {CurvePoint} from './envelope.ts';
import {curveAt, fadeEnds} from './envelope.ts';
import {highpass} from './filter.ts';
import {limitBuffer} from './limiter.ts';
import type {Palette} from './palette-types.ts';
import {addDelay, addReverb} from './reverb.ts';

/** Highest level of the synthesised track, in dBFS. */
export const SYNTH_CEILING_DB = -2;

/** Seconds of fade-in at the start of the track. */
const FADE_IN_S = 0.15;

/** Longest fade-out at the end of the track, in seconds. */
const FADE_OUT_S = 3;

/** Linear level of the cue bus against the bed. */
const CUE_LEVEL = 2.5;

/** Cutoff of the filter that removes rumble and offset, in hertz. */
const RUMBLE_HZ = 22;

/** What the track is made from. */
export interface TrackPlan {
  palette: Palette;
  /** Root note name. */
  key: string;
  /** Beats per minute. */
  tempo: number;
  /** Seed for every random choice. */
  seed: number;
  /** Film length in seconds. The track has exactly this many seconds. */
  duration: number;
  /** Play the pad and pulse. */
  bed: boolean;
  /** Intensity points, sorted by film time in seconds. */
  intensity: readonly CurvePoint[];
  /** Cues to play, with film times in seconds. */
  cues: readonly Cue[];
}

/**
 * Renders a track.
 *
 * @returns Stereo samples at 48 kHz whose length is
 *   `round(duration * 48000)`. The peak stays below
 *   {@link SYNTH_CEILING_DB} dBFS, and the first and last samples are zero.
 */
export function composeTrack(plan: TrackPlan): StereoBuffer {
  const rate = SAMPLE_RATE;
  const samples = samplesOf(plan.duration);
  const sum = createBuffer(samples);
  if (plan.bed) {
    addBuffer(sum, renderBed({...plan, rate}), 0, 1);
  }
  const bus = createBuffer(samples);
  mixCues(bus, plan.cues, {
    key: {palette: plan.palette, key: plan.key},
    seed: plan.seed,
    intensityAt: t => curveAt(plan.intensity, t),
    rate,
  });
  const [time, feedback, mix] = plan.palette.cue.echo;
  addDelay(bus, time, feedback, mix);
  addBuffer(sum, bus, 0, CUE_LEVEL);
  const [wet, seconds] = plan.palette.reverb;
  addReverb(sum, wet, seconds);
  const out = Math.min(FADE_OUT_S, finalLength(plan.duration));
  for (const ch of [sum.left, sum.right]) {
    highpass(ch, RUMBLE_HZ, rate);
    fadeEnds(ch, FADE_IN_S, out, rate);
  }
  limitBuffer(sum, SYNTH_CEILING_DB);
  return sum;
}
