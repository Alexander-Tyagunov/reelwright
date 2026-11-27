/**
 * @fileoverview Reads and checks `meta.sound` and turns it into settings
 * with every default filled in.
 */
import {UserError} from '../core/errors.ts';
import {checkRange} from '../core/validate.ts';
import type {FilmSpec} from '../shared/contract.ts';
import {type AutoCues, resolveAuto} from './auto-cues.ts';
import type {CurvePoint} from './envelope.ts';
import type {Palette} from './palette-types.ts';
import {DEFAULT_PALETTE, PALETTE_NAMES, PALETTES} from './palettes.ts';
import {KEY_PATTERN} from './scale.ts';

/** Intensity used when the spec gives none. */
export const DEFAULT_INTENSITY = 0.75;

/** Lowest tempo in beats per minute. */
export const MIN_TEMPO = 30;

/** Highest tempo in beats per minute. */
export const MAX_TEMPO = 200;

const FIELDS = [
  'palette',
  'bed',
  'cues',
  'volume',
  'seed',
  'key',
  'tempo',
  'intensity',
  'auto',
];

/** `meta.sound` with every default applied. */
export interface ResolvedSound {
  palette: Palette;
  /** Play the pad and pulse. */
  bed: boolean;
  /** Play cues. */
  cues: boolean;
  /** How much each kind of derived cue plays. */
  auto: AutoCues;
  /** Linear level against the -14 LUFS target, 0 to 1. */
  volume: number;
  /** Whole number seed. */
  seed: number;
  /** Root note name. */
  key: string;
  /** Beats per minute. */
  tempo: number;
  /** Intensity curve, points sorted by film time in seconds. */
  intensity: CurvePoint[];
}

function flag(label: string, value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new UserError(`${label} must be true or false, got ${show(value)}`);
  }
  return value;
}

function show(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
}

function paletteOf(value: unknown): Palette {
  const name = value === undefined ? DEFAULT_PALETTE : value;
  const found = typeof name === 'string' ? PALETTES[name] : undefined;
  if (!found) {
    throw new UserError(
      `meta.sound.palette ${show(name)} is not a palette. ` +
        `Choose one of: ${PALETTE_NAMES.join(', ')}`,
    );
  }
  return found;
}

function keyOf(value: unknown, palette: Palette): string {
  if (value === undefined) {
    return palette.key;
  }
  if (typeof value !== 'string' || !KEY_PATTERN.test(value)) {
    throw new UserError(
      `meta.sound.key must be a note name such as C, F# or Bb, got ${show(value)}`,
    );
  }
  return value;
}

function pointsOf(value: unknown): CurvePoint[] {
  if (value === undefined) {
    return [{at: 0, value: DEFAULT_INTENSITY}];
  }
  if (typeof value === 'number') {
    return [{at: 0, value: checkRange('meta.sound.intensity', value, 0, 1)}];
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new UserError(
      'meta.sound.intensity must be a number from 0 to 1 or a list of ' +
        '{"at": seconds, "value": 0 to 1} points',
    );
  }
  const points = value.map((p: unknown, i): CurvePoint => {
    const label = `meta.sound.intensity[${i}]`;
    const o = (typeof p === 'object' && p !== null ? p : {}) as CurvePoint;
    return {
      at: checkRange(`${label}.at`, o.at, 0, 86400),
      value: checkRange(`${label}.value`, o.value, 0, 1),
    };
  });
  return points.sort((a, b) => a.at - b.at);
}

function fieldsOf(sound: unknown): Record<string, unknown> {
  if (sound === true) {
    return {};
  }
  if (typeof sound !== 'object' || sound === null || Array.isArray(sound)) {
    throw new UserError(
      `meta.sound must be true, false or an object, got ${show(sound)}`,
    );
  }
  const raw = sound as Record<string, unknown>;
  const unknown = Object.keys(raw).filter(k => !FIELDS.includes(k));
  if (unknown.length) {
    throw new UserError(
      `meta.sound has unknown field ${unknown.map(show).join(', ')}. ` +
        `Allowed fields: ${FIELDS.join(', ')}`,
    );
  }
  return raw;
}

/**
 * Checks `meta.sound` and fills in defaults.
 *
 * @param sound The `meta.sound` value from the spec.
 * @returns The settings, or null when the film is silent: absent or false.
 * @throws UserError that names the field and what is allowed when a value is
 *   wrong, including the palette names for an unknown palette.
 */
export function resolveSound(sound: unknown): ResolvedSound | null {
  if (sound === undefined || sound === false || sound === null) {
    return null;
  }
  const raw = fieldsOf(sound);
  const palette = paletteOf(raw.palette);
  const bed = flag('meta.sound.bed', raw.bed, true);
  const cues = flag('meta.sound.cues', raw.cues, true);
  if (!bed && !cues) {
    throw new UserError(
      'meta.sound has bed and cues both off, so there is nothing to play. ' +
        'Turn one on, or set "sound": false.',
    );
  }
  return {
    palette,
    bed,
    cues,
    auto: resolveAuto(raw.auto),
    volume: checkRange('meta.sound.volume', raw.volume ?? 1, 0, 1),
    seed: checkRange(
      'meta.sound.seed',
      raw.seed ?? 0,
      -2147483648,
      2147483647,
      'integer',
    ),
    key: keyOf(raw.key, palette),
    tempo: checkRange(
      'meta.sound.tempo',
      raw.tempo ?? palette.tempo,
      MIN_TEMPO,
      MAX_TEMPO,
    ),
    intensity: pointsOf(raw.intensity),
  };
}

/** True when the film's `meta.sound` asks for generated sound. */
export function isSoundOn(film: FilmSpec): boolean {
  return resolveSound(film.meta?.sound) !== null;
}
