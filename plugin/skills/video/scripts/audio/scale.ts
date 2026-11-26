/**
 * @fileoverview Pitch: root notes, scale degrees and frequencies. Pitches
 * use equal temperament with A4 at 440 Hz.
 */

const LETTERS = 'CDEFGAB';
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/** Accepted root names: a letter A to G, then `#` or `b` when needed. */
export const KEY_PATTERN = /^[A-G][#b]?$/;

/**
 * Pitch class of a root name.
 *
 * @param key Name such as `C`, `F#` or `Bb`.
 * @returns A whole number from 0 (C) to 11 (B).
 */
export function pitchClass(key: string): number {
  const base = LETTER_SEMITONES[LETTERS.indexOf(key.charAt(0))] ?? 0;
  const shift = key.charAt(1) === '#' ? 1 : key.charAt(1) === 'b' ? -1 : 0;
  return (base + shift + 12) % 12;
}

/** Frequency in hertz of a MIDI note number. 69 is A4, 440 Hz. */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Frequency of a scale degree.
 *
 * @param key Root name such as `A`.
 * @param scale Semitone steps of the scale above the root.
 * @param degree Scale step from the root, 0 is the root. A step past the
 *   end of the scale continues in the next octave; a negative step goes
 *   down.
 * @param octave Octave of the root in scientific pitch (4 holds middle C).
 * @returns Frequency in hertz.
 */
export function degreeHz(
  key: string,
  scale: readonly number[],
  degree: number,
  octave: number,
): number {
  const size = scale.length;
  const wraps = Math.floor(degree / size);
  const index = degree - wraps * size;
  const semitones = (scale[index] ?? 0) + 12 * wraps;
  return midiToHz(12 * (octave + 1) + pitchClass(key) + semitones);
}
