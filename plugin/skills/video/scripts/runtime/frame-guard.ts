/**
 * @fileoverview Catches errors thrown by a scene while a frame is drawn, so
 * one broken scene names itself instead of stopping the page. Each scene is
 * recorded once on `window.__errors`, however many frames it breaks.
 */

import {messageOf, recordError} from './errors.ts';
import {round3} from './math.ts';
import type {BuiltScene} from './scene-build.ts';

/** Catches scene failures during a frame and reports them. */
export interface FrameGuard {
  /**
   * Runs the drawing of one scene. A thrown error is kept, not rethrown.
   * @param scene The scene being drawn.
   * @param t Film time of the frame, in seconds.
   * @param draw The drawing code.
   */
  run(scene: BuiltScene, t: number, draw: () => void): void;
  /** Returns the messages kept since the last call, then forgets them. */
  take(): string[];
}

/** Creates a guard. One guard serves one film page. */
export function createFrameGuard(): FrameGuard {
  const reported = new Set<number>();
  let failures: string[] = [];
  return {
    run(scene, t, draw) {
      try {
        draw();
      } catch (err) {
        const {index} = scene.slot;
        const message =
          `scene ${index + 1} (${scene.spec.type}) threw at ` +
          `t=${round3(t).toFixed(2)}s: ${messageOf(err)}`;
        failures.push(message);
        if (!reported.has(index)) {
          reported.add(index);
          recordError(message);
        }
      }
    },
    take() {
      const out = failures;
      failures = [];
      return out;
    },
  };
}
