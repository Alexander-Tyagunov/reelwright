/**
 * @fileoverview The pulse: soft plucked notes or low thumps on the beat,
 * played only where the intensity is high enough.
 */
import type {StereoBuffer} from './buffer.ts';
import {addMono} from './buffer.ts';
import type {ChordSpan} from './chords.ts';
import {withPeak} from './cue-sounds.ts';
import type {Partial} from './oscillator.ts';
import {pluck} from './oscillator.ts';
import type {Palette} from './palette-types.ts';
import {degreeHz} from './scale.ts';

/** Peak level of one pulse note at level 1 and accent 1, linear. */
export const PULSE_PEAK = 0.07;

/** Where the second thump of a heartbeat falls, in beats. */
const SECOND_THUMP_BEATS = 0.45;

/** Sideways spread of arpeggio notes: pan from -0.4 to 0.4. */
const ARP_PAN = 0.4;

/** What the pulse needs to know about the bed. */
export interface PulsePlan {
  palette: Palette;
  key: string;
  /** Beats per minute. */
  tempo: number;
  spans: readonly ChordSpan[];
  /** Film length in seconds. */
  duration: number;
  /** Bed intensity at a film time in seconds, 0 to 1. */
  intensityAt: (t: number) => number;
  /** Sample rate in samples per second. */
  rate: number;
}

function partialsOf(p: Palette): Partial[] {
  const {pulse} = p;
  return pulse.harmonics.map((level, i) => ({
    ratio: i + 1,
    level,
    decay: pulse.decay / Math.sqrt(i + 1),
  }));
}

function spanAt(spans: readonly ChordSpan[], t: number): ChordSpan | undefined {
  return spans.find(s => t >= s.start && t < s.end);
}

function note(plan: PulsePlan, hz: number, level: number): Float32Array {
  const {palette, rate} = plan;
  const seconds = Math.min(2, palette.pulse.decay * 1.5);
  const tone = pluck(hz, seconds, partialsOf(palette), rate);
  return withPeak(tone, PULSE_PEAK * level);
}

function arpeggio(plan: PulsePlan, bus: StereoBuffer): void {
  const {palette: p, key, tempo, rate} = plan;
  const interval = 60 / tempo / p.pulse.perBeat;
  for (let k = 0; k * interval < plan.duration; k++) {
    const t = k * interval;
    const span = spanAt(plan.spans, t);
    const level = plan.intensityAt(t);
    if (!span || level < p.pulse.minIntensity) {
      continue;
    }
    const slot = p.pulse.pattern[k % p.pulse.pattern.length] ?? 0;
    const step = p.pad.stack[slot % p.pad.stack.length] ?? 0;
    const hz = degreeHz(key, p.scale, span.degree + step, p.pulse.octave);
    const accent = p.pulse.accent[k % p.pulse.accent.length] ?? 1;
    const mono = note(plan, hz, p.pulse.level * accent * level);
    addMono(bus, mono, Math.round(t * rate), 1, k % 2 ? ARP_PAN : -ARP_PAN);
  }
}

function heartbeat(plan: PulsePlan, bus: StereoBuffer): void {
  const {palette: p, key, tempo, rate} = plan;
  const interval = 60 / tempo / p.pulse.perBeat;
  const hz = degreeHz(key, p.scale, 0, p.pulse.octave);
  for (let k = 0; k * interval < plan.duration; k++) {
    const t = k * interval;
    const level = plan.intensityAt(t);
    if (level < p.pulse.minIntensity) {
      continue;
    }
    const beat = 60 / tempo;
    [0, 1].forEach(n => {
      const at = t + n * SECOND_THUMP_BEATS * beat;
      const accent = p.pulse.accent[n] ?? 1;
      const mono = note(plan, hz, p.pulse.level * accent * level);
      addMono(bus, mono, Math.round(at * rate), 1, 0);
    });
  }
}

/**
 * Adds the pulse of the palette to a bus. Does nothing for a palette with
 * no pulse.
 *
 * @param bus Stereo buffer, changed in place.
 */
export function addPulse(bus: StereoBuffer, plan: PulsePlan): void {
  const {style} = plan.palette.pulse;
  if (style === 'arp') {
    arpeggio(plan, bus);
  } else if (style === 'heartbeat') {
    heartbeat(plan, bus);
  }
}
