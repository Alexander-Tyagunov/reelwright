/**
 * @fileoverview A collector for the problems found in a file, so one run
 * lists many of them and the user fixes them together.
 */
import {UserError} from '../core/errors.ts';

const MAX_SHOWN = 12;

/** The type of a JSON object read from a file. */
export type Raw = Record<string, unknown>;

/** Tells whether a value is a plain JSON object. */
export function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Tells whether a value is a finite number. */
export function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Tells whether a value is a whole number of at least 1. */
export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** Tells whether a value is a string with a visible character. */
export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Problems found so far, with the file they belong to. */
export interface Problems {
  /** Records one problem. */
  add(path: string, message: string): void;
  /** Number of problems recorded. */
  count(): number;
  /** Throws a `UserError` that lists the problems, if there are any. */
  throwIfAny(file: string, hint: string): void;
}

/** Starts an empty list. */
export function problems(): Problems {
  const list: string[] = [];
  return {
    add: (path, message) => void list.push(`${path}: ${message}`),
    count: () => list.length,
    throwIfAny(file, hint) {
      if (!list.length) {
        return;
      }
      const shown = list.slice(0, MAX_SHOWN).map(p => `  ${p}`);
      const more =
        list.length > MAX_SHOWN
          ? `\n  and ${list.length - MAX_SHOWN} more`
          : '';
      throw new UserError(
        `${file} has ${list.length} problem(s):\n${shown.join('\n')}${more}\n${hint}`,
      );
    },
  };
}
