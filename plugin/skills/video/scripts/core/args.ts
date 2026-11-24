/**
 * @fileoverview Command-line argument parsing and typed flag readers.
 */
import {UserError} from './errors.ts';

/** Parsed command line: positional words and `--flag` values. */
export interface Args {
  /** Words that are not flags, in order. The first is often the film spec. */
  positional: string[];
  /**
   * Flag values by name without the dashes. A flag with no value is `true`.
   * `--no-x` sets `x` to `false`. `--x=v` and `--x v` both set `x` to `v`.
   */
  flags: Record<string, string | boolean>;
}

/**
 * Flags that never take a value. The word after one of them stays
 * positional, so `--page-only film.json` finds the spec.
 */
export const BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  'draft',
  'force',
  'gpu',
  'json',
  'loop',
  'md',
  'page-only',
  'png',
  'strict',
]);

/**
 * Splits an argument list into positional words and flags.
 * A word after a flag is its value unless it starts with `--` or the flag
 * is in {@link BOOLEAN_FLAGS}.
 *
 * @param argv Arguments after the command name.
 */
export function parseArgs(argv: readonly string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = Object.create(null);
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i] ?? '';
    if (!word.startsWith('--')) {
      positional.push(word);
      continue;
    }
    const eq = word.indexOf('=');
    if (eq !== -1) {
      flags[word.slice(2, eq)] = word.slice(eq + 1);
      continue;
    }
    const key = word.slice(2);
    if (key.startsWith('no-')) {
      flags[key.slice(3)] = false;
      continue;
    }
    const next = argv[i + 1];
    const takesValue = !BOOLEAN_FLAGS.has(key);
    if (takesValue && next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return {positional, flags};
}

/**
 * Reads a flag that must carry text, such as `--out dir`.
 *
 * @returns The text, or `undefined` when the flag is absent or `false`.
 * @throws UserError when the flag is present without a value.
 */
export function stringFlag(args: Args, name: string): string | undefined {
  const value = args.flags[name];
  if (value === undefined || value === false) {
    return undefined;
  }
  if (value === true) {
    throw new UserError(`--${name} needs a value, for example --${name} x`);
  }
  return value;
}

/**
 * Reads a flag that must be a finite number.
 *
 * @param unit Words used in the error message, for example `seconds`.
 * @returns The number, or `undefined` when the flag is absent.
 * @throws UserError when the value is not a finite number.
 */
export function numberFlag(
  args: Args,
  name: string,
  unit = 'a number',
): number | undefined {
  const text = stringFlag(args, name);
  if (text === undefined) {
    return undefined;
  }
  const value = Number(text);
  if (text.trim() === '' || !Number.isFinite(value)) {
    throw new UserError(`--${name} must be ${unit}, got "${text}"`);
  }
  return value;
}

/** Reads an on/off flag. Only a bare flag or the text `true` is on. */
export function boolFlag(args: Args, name: string): boolean {
  const value = args.flags[name];
  return value === true || value === 'true';
}
