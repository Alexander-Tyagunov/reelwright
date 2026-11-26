/**
 * @fileoverview Renders each planned cue and mixes it into a bus at its
 * time. Every cue has its own random stream, so changing one cue never
 * changes another.
 */
import type {StereoBuffer} from './buffer.ts';
import {addBuffer, addMono, samplesOf} from './buffer.ts';
import {boomSound, hitSound} from './cue-impact.ts';
import {riseSound, WHOOSH_S, whooshSound} from './cue-noise.ts';
import {chimeSound, popSound, stingSound, tickSound} from './cue-sounds.ts';
import type {Cue, CueKey} from './cues.ts';
import {createRandom, derivedSeed} from './random.ts';
import {degreeHz} from './scale.ts';

/** Stream number of the first cue in the seed mix. */
const CUE_STREAM = 1000;

/** Sideways spread of pitched cues: pan from -0.3 to 0.3. */
const PAN_SPREAD = 0.3;

/** Scale degrees of the three notes of a sting. */
const STING_DEGREES = [0, 2, 4];

/** What the mixer needs besides the cues. */
export interface MixOptions {
  /** Palette and key. */
  key: CueKey;
  /** Track seed. */
  seed: number;
  /** Bed intensity at a film time in seconds, 0 to 1. */
  intensityAt: (t: number) => number;
  /** Sample rate in samples per second. */
  rate: number;
}

function stingNotes(k: CueKey): number[] {
  const {palette} = k;
  return STING_DEGREES.map(d =>
    degreeHz(k.key, palette.scale, d, palette.cue.octave),
  );
}

function renderMono(
  cue: Cue,
  o: MixOptions,
  gain: number,
  n: number,
): Float32Array | null {
  const {palette} = o.key;
  const set = palette.cue;
  const rng = createRandom(derivedSeed(o.seed, CUE_STREAM + 1000 + n));
  const hz = cue.hz ?? 440;
  switch (cue.kind) {
    case 'tick':
      return tickSound(hz, gain, set, o.rate);
    case 'chime':
      return chimeSound(hz, gain, set, o.rate);
    case 'pop':
      return popSound(hz, gain, o.rate);
    case 'sting':
      return stingSound(stingNotes(o.key), gain, set, o.rate);
    case 'hit':
      return hitSound(rng, hz, gain, set, o.rate);
    case 'boom':
      return boomSound(rng, hz, gain, set, o.rate);
    default:
      return null;
  }
}

function renderWide(cue: Cue, o: MixOptions, gain: number, n: number) {
  const rng = createRandom(derivedSeed(o.seed, CUE_STREAM + 1 + n));
  const set = o.key.palette.cue;
  if (cue.kind === 'rise') {
    const seconds = cue.duration ?? 2;
    return riseSound(rng, cue.hz ?? 220, seconds, gain, set, o.rate);
  }
  return whooshSound(rng, gain, set, o.rate);
}

/**
 * Renders the cues and adds them to a bus.
 *
 * @param bus Stereo buffer, changed in place.
 * @param cues Planned cues with film times in seconds.
 */
export function mixCues(
  bus: StereoBuffer,
  cues: readonly Cue[],
  o: MixOptions,
): void {
  cues.forEach((cue, n) => {
    const gain = cue.gain * (0.5 + 0.5 * o.intensityAt(cue.t));
    const at = samplesOf(cue.t);
    if (cue.kind === 'whoosh' || cue.kind === 'rise') {
      const wide = renderWide(cue, o, gain, n);
      const lead = cue.kind === 'whoosh' ? samplesOf(WHOOSH_S / 2) : 0;
      addBuffer(bus, wide, at - lead, 1);
      return;
    }
    const mono = renderMono(cue, o, gain, n);
    if (mono) {
      const pan = createRandom(derivedSeed(o.seed, CUE_STREAM + 500 + n));
      const impact = cue.kind === 'hit' || cue.kind === 'boom';
      const side = impact ? 0 : pan.range(-PAN_SPREAD, PAN_SPREAD);
      addMono(bus, mono, at, 1, side);
    }
  });
}
