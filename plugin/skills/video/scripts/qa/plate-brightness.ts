/**
 * @fileoverview The brightness check of `reel plate`: runs of frames that are
 * much darker or lighter than the frames around them, in the whole frame or
 * in its lower third, which is where a lost foreground shows first.
 */
import type {FrameBrightness} from '../video/brightness.ts';
import type {BrightnessRun} from './brightness-runs.ts';
import {findBrightnessRuns} from './brightness-runs.ts';

/** A run of odd frames and where it was seen. */
export interface PlateRun extends BrightnessRun {
  /** The part of the frame that gave the run: whole frame or lower third. */
  where: 'whole frame' | 'lower third';
}

/**
 * Finds the odd runs of a plate, in the whole frame and in its lower third.
 * A run that both parts show is reported once, from the lower third.
 *
 * @returns Runs in frame order.
 */
export function plateRuns(brightness: FrameBrightness): PlateRun[] {
  const lower = findBrightnessRuns(brightness.lower).map(
    (r): PlateRun => ({...r, where: 'lower third'}),
  );
  const whole = findBrightnessRuns(brightness.whole)
    .filter(r => !lower.some(l => l.first <= r.last && r.first <= l.last))
    .map((r): PlateRun => ({...r, where: 'whole frame'}));
  return [...lower, ...whole].sort((a, b) => a.first - b.first);
}

/**
 * Words one run for the user, with frame file numbers.
 *
 * @param first Number the first frame file carries in its name.
 */
export function describeRun(run: PlateRun, first: number): string {
  const a = run.first + first;
  const b = run.last + first;
  const range = a === b ? `frame ${a}` : `frames ${a}-${b}`;
  const [x, y] = run.around;
  return (
    `${range}: ${run.where} mean ${run.mean.toFixed(1)} against ` +
    `${x.toFixed(1)} before and ${y.toFixed(1)} after`
  );
}
