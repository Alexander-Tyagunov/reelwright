/**
 * @fileoverview The shape of a sound palette: scale, chords, tempo, timbre
 * and the sound of each cue. Palettes are listed in `palettes.ts`.
 */

/** The slow pad under the film. */
export interface PadSettings {
  /** Octave of the chord root, in scientific pitch (4 holds middle C). */
  octave: number;
  /** Scale steps above the chord root that sound with it, 0 is the root. */
  stack: readonly number[];
  /** Levels of harmonics 1, 2, 3 and so on, each from 0 to 1. */
  harmonics: readonly number[];
  /** Spread between the two copies of each note, in cents (1/100 tone). */
  detuneCents: number;
  /** Seconds a chord takes to fade in and the last one to fade out. */
  attack: number;
  /** Low-pass cutoff of the pad, in hertz. */
  cutoffHz: number;
  /** Speed of the slow brightness swell, in hertz. */
  lfoHz: number;
  /** Level of the note an octave below the root, from 0 to 1. */
  bass: number;
}

/** Soft rhythm under the pad. */
export interface PulseSettings {
  /**
   * `none`, `arp` (chord notes plucked in a pattern) or `heartbeat` (two low
   * thumps).
   */
  style: 'none' | 'arp' | 'heartbeat';
  /** Notes per beat for `arp`. 0.5 plays every second beat. */
  perBeat: number;
  /** Octave of the plucked notes. */
  octave: number;
  /** Chord note index for each step, repeating. */
  pattern: readonly number[];
  /** Level factor of each step, from 0 to 1, repeating. */
  accent: readonly number[];
  /** Seconds in which a plucked note falls by 60 dB. */
  decay: number;
  /** Levels of harmonics 1, 2, 3 of the plucked note. */
  harmonics: readonly number[];
  /** Level from 0 to 1 against the pad. */
  level: number;
  /** Lowest intensity at which the pulse plays, 0 to 1. */
  minIntensity: number;
}

/** The sound of the cues. */
export interface CueSettings {
  /** Octave of the tick and chime notes. */
  octave: number;
  /** Frequency ratios of the partials of a tick or chime. */
  ratios: readonly number[];
  /** Levels of those partials, each from 0 to 1. */
  levels: readonly number[];
  /** Seconds in which a tick falls by 60 dB. */
  tickDecay: number;
  /** Seconds in which a chime falls by 60 dB. */
  chimeDecay: number;
  /** Band centre in hertz at the start and the end of a whoosh. */
  whoosh: readonly [number, number];
  /** Octave of the low impact. */
  impactOctave: number;
  /** Seconds a boom rings. */
  boomSeconds: number;
  /** Level factor of every impact against other cues, 0 to 1. */
  impactLevel: number;
  /** Echo on the cues: seconds between repeats, feedback, mix. */
  echo: readonly [number, number, number];
}

/** One sound palette. */
export interface Palette {
  /** Name used in `meta.sound.palette`. */
  name: string;
  /** One line that says what the palette sounds like. */
  description: string;
  /** Root note when the spec gives no key, such as `A` or `F#`. */
  key: string;
  /** Semitone steps of the scale above the root, from 0 up to 11. */
  scale: readonly number[];
  /** Scale degrees of the chord roots, in order, then repeated. */
  progression: readonly number[];
  /** Scale degree of the chord before the final tonic chord. */
  cadence: number;
  /** Beats per minute when the spec gives no tempo. */
  tempo: number;
  /** Beats each chord lasts. */
  chordBeats: number;
  pad: PadSettings;
  pulse: PulseSettings;
  cue: CueSettings;
  /** Reverb level against the dry signal, 0 to 1, and its length in seconds. */
  reverb: readonly [number, number];
  /** Scale degrees that text ticks step through, in order. */
  tickRun: readonly number[];
}
