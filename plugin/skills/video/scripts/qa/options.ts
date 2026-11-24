/**
 * @fileoverview Reads the flags of the `qa` command into one typed object.
 */
import type {Args} from '../core/args.ts';
import {boolFlag, numberFlag, stringFlag} from '../core/args.ts';
import {DEFAULT_MAX_HOLD_S} from './thresholds.ts';

/** Everything the `qa` command accepts. */
export interface QaOptions {
  /** Frame size to check, such as `1080x1350`, or undefined for the spec's. */
  size: string | undefined;
  /** Path of the video to check instead of `out/film.mp4`. */
  video: string | undefined;
  /** Fail the run on warnings too. */
  strict: boolean;
  /** Print the report as JSON instead of a table. */
  json: boolean;
  /** Run the page gates only. */
  pageOnly: boolean;
  /** Draw with the graphics card. */
  gpu: boolean;
  /** Treat a video checked without a spec as a loop. */
  loop: boolean;
  /** Longest still stretch, in seconds, for a video without a spec. */
  maxHold: number;
}

/**
 * Reads `--size`, `--video`, `--strict`, `--json`, `--page-only`, `--gpu`,
 * `--loop` and `--max-hold`.
 *
 * @throws UserError when a flag that needs a value has none, or
 *   `--max-hold` is not a number.
 */
export function readOptions(args: Args): QaOptions {
  return {
    size: stringFlag(args, 'size'),
    video: stringFlag(args, 'video'),
    strict: boolFlag(args, 'strict'),
    json: boolFlag(args, 'json'),
    pageOnly: boolFlag(args, 'page-only'),
    gpu: boolFlag(args, 'gpu'),
    loop: boolFlag(args, 'loop'),
    maxHold: numberFlag(args, 'max-hold', 'seconds') ?? DEFAULT_MAX_HOLD_S,
  };
}
