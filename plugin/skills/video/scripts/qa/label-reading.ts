/**
 * @fileoverview Reading time of text that moves with a picture. Such text is
 * never still, so it counts as readable while it moves slower than a limit.
 * Pure: it reads the speed samples that a scene records. Seconds throughout.
 */
import type {TextMotion} from '../shared/contract.ts';

/**
 * Finds the longest unbroken time in which the text is shown and moves no
 * faster than the limit.
 *
 * @param limit Speed in fractions of the short side per second.
 * @returns Seconds.
 */
export function longestSlowRun(motion: TextMotion, limit: number): number {
  let best = 0;
  let run = 0;
  for (const speed of motion.speed) {
    run = speed !== null && speed <= limit ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best * motion.step;
}

/**
 * Finds the share of the shown samples in which the text moves faster than
 * the limit.
 *
 * @param limit Speed in fractions of the short side per second.
 * @returns A number from 0 to 1; 0 when the text is never shown.
 */
export function fastShare(motion: TextMotion, limit: number): number {
  const shown = motion.speed.filter(s => s !== null);
  const fast = shown.filter(s => s > limit);
  return shown.length ? fast.length / shown.length : 0;
}
