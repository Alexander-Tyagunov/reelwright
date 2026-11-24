/**
 * @fileoverview Text picture of motion over time: one character per slice of
 * the film, from `_` (frozen) to `#` (large change).
 */
import {FREEZE_DIFF, SPARK_BIN_S} from './thresholds.ts';

const CHARS_PER_ROW = 60;

/** Explains the characters in the order of {@link sparkChar}. */
export const SPARK_LEGEND = [
  `_ <${FREEZE_DIFF} frozen`,
  '. <0.1',
  ': <0.3',
  '- <1',
  '= <3',
  '+ <10',
  '# more',
].join(', ');

/** Maps a mean frame difference, in grey levels, to one character. */
export function sparkChar(value: number): string {
  if (value < FREEZE_DIFF) {
    return '_';
  }
  const steps: ReadonlyArray<[number, string]> = [
    [0.1, '.'],
    [0.3, ':'],
    [1, '-'],
    [3, '='],
    [10, '+'],
  ];
  return steps.find(([limit]) => value < limit)?.[1] ?? '#';
}

/**
 * Draws motion as rows of 60 characters.
 *
 * @param diffs Per-frame differences in grey levels. Index 0 is unused.
 * @param fps Frames per second of the video.
 * @param binS Seconds per character. Default 0.5.
 * @returns One string per row, each starting with its time in seconds.
 */
export function sparkline(
  diffs: readonly number[],
  fps: number,
  binS = SPARK_BIN_S,
): string[] {
  const per = Math.max(1, Math.round(binS * fps));
  const chars: string[] = [];
  for (let k = 1; k < diffs.length; k += per) {
    const slice = diffs.slice(k, k + per);
    const mean = slice.length
      ? slice.reduce((a, b) => a + b, 0) / slice.length
      : 0;
    chars.push(sparkChar(mean));
  }
  const rows: string[] = [];
  for (let i = 0; i < chars.length; i += CHARS_PER_ROW) {
    const time = String(Math.round(i * binS * 100) / 100).padStart(6);
    rows.push(`${time}s |${chars.slice(i, i + CHARS_PER_ROW).join('')}|`);
  }
  return rows;
}
