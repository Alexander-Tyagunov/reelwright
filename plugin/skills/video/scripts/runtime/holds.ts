/**
 * @fileoverview Reading-hold figures. Pure: they turn the settle time of a
 * text into how long it stays readable and how long a reader needs.
 * All times are in seconds.
 */

import {round3} from './math.ts';

/** Fraction of the outgoing transition after which text counts as gone. */
const READABLE_UNTIL = 0.75;
/** Seconds added to every reading time. */
const READING_BASE = 0.5;

/** Input for `readingHold`. */
export interface HoldInput {
  /** Scene-local second at which the text is fully revealed. */
  settle: number;
  /** Scene length in seconds. */
  duration: number;
  /** Length of the transition out of the scene, in seconds. */
  tout: number;
  /** Number of words in the text. */
  words: number;
  /** Seconds of hold required per word. */
  readingRate: number;
  /** True for numbers that are not read as text. */
  noHold: boolean;
}

/** Output of `readingHold`. All values are rounded to 3 decimals. */
export interface HoldFigures {
  /** Settle time, limited to the scene length. */
  settle: number;
  /** Seconds the text stays readable after it has settled. */
  hold: number;
  /** Seconds a reader needs. 0 when `noHold` is set. */
  need: number;
}

/**
 * Computes the reading-hold figures of one text block.
 * @param input Settle time, scene timing and word count.
 */
export function readingHold(input: HoldInput): HoldFigures {
  const settle = Math.min(input.settle, input.duration);
  const visibleUntil = input.duration - input.tout * READABLE_UNTIL;
  const need = input.noHold
    ? 0
    : input.words * input.readingRate + READING_BASE;
  return {
    settle: round3(settle),
    hold: round3(visibleUntil - settle),
    need: round3(need),
  };
}

/**
 * Picks the scene-local time at which a scene shows the most and is at rest.
 * @param start Film time at which the scene starts, in seconds.
 * @param duration Scene length in seconds.
 * @param tout Length of the transition out, in seconds.
 * @param sceneSettle Latest settle time of any text in the scene.
 * @returns Film time in seconds, rounded to 3 decimals.
 */
export function checkTime(
  start: number,
  duration: number,
  tout: number,
  sceneSettle: number,
): number {
  const wanted = Math.max(sceneSettle + 0.1, duration * 0.5);
  return round3(start + Math.min(wanted, duration - tout - 0.05));
}
