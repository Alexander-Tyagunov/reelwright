/**
 * @fileoverview Reads `meta.sound.auto`: how loud each kind of cue that is
 * derived from the picture plays, or whether it plays at all.
 */
import {UserError} from '../core/errors.ts';
import {checkRange} from '../core/validate.ts';

/** Kinds of derived cue, in the order the spec lists them. */
export const AUTO_KINDS = ['transition', 'text', 'ending'] as const;

/** One kind of derived cue. */
export type AutoKind = (typeof AUTO_KINDS)[number];

/**
 * How much each kind of derived cue plays. Each value multiplies the cue
 * gain: 1 is the planned level, 0 removes the cue. Unitless, 0 to 1.
 */
export type AutoCues = Record<AutoKind, number>;

/** Every kind at the planned level, which is what a spec without `auto` gets. */
export const AUTO_ALL: AutoCues = {transition: 1, text: 1, ending: 1};

function show(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
}

function levelOf(kind: AutoKind, value: unknown): number {
  const label = `meta.sound.auto.${kind}`;
  if (value === undefined || value === true) {
    return 1;
  }
  if (value === false) {
    return 0;
  }
  if (typeof value !== 'number') {
    throw new UserError(
      `${label} must be true, false or a number from 0 to 1, got ${show(value)}`,
    );
  }
  return checkRange(label, value, 0, 1);
}

/**
 * Checks `meta.sound.auto` and fills in defaults.
 *
 * @param value The `auto` value: absent, a boolean, or an object with
 *   `transition`, `text` and `ending`, each true, false or 0 to 1.
 * @returns The multiplier of each kind, 0 to 1.
 * @throws UserError that names the field and what is allowed when the value
 *   or one of its keys is wrong.
 */
export function resolveAuto(value: unknown): AutoCues {
  if (value === undefined || value === true) {
    return AUTO_ALL;
  }
  if (value === false) {
    return {transition: 0, text: 0, ending: 0};
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UserError(
      'meta.sound.auto must be true, false or an object with ' +
        `${AUTO_KINDS.join(', ')}, got ${show(value)}`,
    );
  }
  const raw = value as Record<string, unknown>;
  const unknown = Object.keys(raw).filter(
    k => !(AUTO_KINDS as readonly string[]).includes(k),
  );
  if (unknown.length) {
    throw new UserError(
      `meta.sound.auto has unknown key ${unknown.map(show).join(', ')}. ` +
        `Allowed keys: ${AUTO_KINDS.join(', ')}`,
    );
  }
  return {
    transition: levelOf('transition', raw.transition),
    text: levelOf('text', raw.text),
    ending: levelOf('ending', raw.ending),
  };
}
