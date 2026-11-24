/**
 * @fileoverview Small pure helpers that gates use to write messages: rounding
 * and names of scenes and texts.
 */
import type {FilmInfo} from '../shared/contract.ts';

/** Rounds to 2 decimal places. */
export function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Rounds to 3 decimal places. */
export function r3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Names a scene for a message, such as `scene 2 (bullets)`.
 *
 * @param index Zero-based scene index. A negative index means an overlay.
 */
export function sceneLabel(
  info: Pick<FilmInfo, 'scenes'>,
  index: number,
): string {
  const scene = info.scenes[index];
  return index >= 0 && scene ? `scene ${index + 1} (${scene.type})` : 'overlay';
}

/** Wraps text in double quotes and collapses runs of white space. */
export function quoted(text: string): string {
  return `"${text.replace(/\s+/g, ' ')}"`;
}

/**
 * Finds the scene that is on screen at a film time.
 *
 * @param t Film time in seconds.
 * @returns Zero-based index of the last scene that has started by `t`.
 */
export function sceneAt(info: Pick<FilmInfo, 'scenes'>, t: number): number {
  let found = 0;
  for (const scene of info.scenes) {
    if (t >= scene.start - 1e-6) {
      found = scene.index;
    }
  }
  return found;
}
