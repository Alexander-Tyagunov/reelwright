/**
 * @fileoverview Field checks for scene specs. Each failure says which field
 * is wrong, what was expected, what was found and which fields the scene
 * accepts. The runtime adds the scene number and type in front.
 */

import type {SceneSpec} from '../../../shared/contract.ts';

/** Fields every scene accepts, so they are never reported as unknown. */
const COMMON_FIELDS = ['type', 'duration', 'id', 'chapter'];

/** The checks of one scene. Each throws an `Error` for a bad field. */
export interface SceneChecks {
  /** Requires a finite number at `path`, such as `items[0].value`. */
  number(path: string, value: unknown): number;
  /** Allows a missing value; a present one must be a finite number. */
  optionalNumber(path: string, value: unknown): number | undefined;
  /** Requires a string with some text at `path`. */
  text(path: string, value: unknown): string;
  /** Requires an array with `min` to `max` entries at `path`. */
  list(path: string, value: unknown, min: number, max: number): unknown[];
}

function describe(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  const text =
    typeof value === 'number' ? String(value) : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/**
 * Creates the checks of one scene.
 * @param scene The scene spec, used to find misspelt field names.
 * @param fields Every field the scene accepts, in the order to show them.
 */
export function sceneChecks(
  scene: SceneSpec,
  fields: readonly string[],
): SceneChecks {
  const unknown = Object.keys(scene).filter(
    k => !fields.includes(k) && !COMMON_FIELDS.includes(k),
  );
  const fail = (path: string, expected: string, value: unknown): never => {
    const typo =
      value === undefined && unknown.length
        ? ` Not a field of this scene: ${unknown.join(', ')}.`
        : '';
    throw new Error(
      `${path} must be ${expected}; got ${describe(value)}.${typo} ` +
        `Fields: ${fields.join(', ')}`,
    );
  };
  const finite = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);
  return {
    number: (path, value) =>
      finite(value) ? value : fail(path, 'a number', value),
    optionalNumber: (path, value) =>
      value === undefined || finite(value)
        ? value
        : fail(path, 'a number', value),
    text: (path, value) =>
      typeof value === 'string' && value.trim()
        ? value
        : fail(path, 'a non-empty string', value),
    list(path, value, min, max) {
      if (!Array.isArray(value) || value.length < min || value.length > max) {
        return fail(path, `a list of ${min} to ${max} entries`, value);
      }
      return value;
    },
  };
}
