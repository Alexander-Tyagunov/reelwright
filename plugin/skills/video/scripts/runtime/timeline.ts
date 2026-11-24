/**
 * @fileoverview Film timeline. Pure and DOM-free: it turns scene durations
 * into start and end times. All times are in seconds.
 */

import type {TransitionKind} from '../shared/contract.ts';
import {round3} from './math.ts';

/** Timeline settings from the film `meta` block. */
export interface TimelineMeta {
  /** Transition kind. `cut` means no overlap. */
  transition: TransitionKind;
  /** Seconds two adjacent scenes overlap. */
  transitionDuration: number;
  /** When true there is no lead and the last scene fades out. */
  loop: boolean;
  /** Seconds of the first entrance to skip. Default 0.5. */
  lead?: number | undefined;
  /** Frames per second. */
  fps: number;
}

/** What the timeline needs to know about one scene. */
export interface TimelineScene {
  type: string;
  /** Seconds on screen, transitions included. */
  duration: number;
}

/** Timing of one scene, in seconds from the start of the film. */
export interface SceneSlot {
  index: number;
  /** Film time at which the scene starts. Negative for the first scene. */
  start: number;
  /** Film time at which the scene ends. */
  end: number;
  /** Seconds the scene is on screen. */
  duration: number;
  /** Length of the transition into this scene. 0 for the first scene. */
  tin: number;
  /** Length of the transition out of this scene. */
  tout: number;
}

/** The computed timeline. */
export interface Timeline {
  /** Seconds adjacent scenes overlap. */
  overlap: number;
  /** Seconds of the first entrance that are skipped. */
  lead: number;
  slots: SceneSlot[];
  /** Total length in seconds. */
  duration: number;
  /** Total frame count: `round(duration * fps)`. */
  frames: number;
}

const DEFAULT_LEAD = 0.5;
const LOOP_FADE = 0.4;

function checkScene(
  scene: TimelineScene,
  index: number,
  overlap: number,
  known: readonly string[] | undefined,
): void {
  const label = `scene ${index + 1}`;
  if (known && !known.includes(scene.type)) {
    throw new Error(
      `${label}: unknown type "${scene.type}". Known: ${known.join(', ')}`,
    );
  }
  if (!(scene.duration > 0)) {
    throw new Error(
      `${label} (${scene.type}): duration must be a positive number of seconds`,
    );
  }
  if (index > 0 && scene.duration <= overlap * 2) {
    throw new Error(
      `${label} (${scene.type}): duration ${scene.duration}s is too short for a ${overlap}s transition`,
    );
  }
}

/**
 * Computes start, end, transition lengths, total duration and frame count.
 * @param meta Transition, loop, lead and frame rate.
 * @param scenes Scene types and durations, in order.
 * @param known Registered scene types. When given, unknown types throw.
 * @throws Error with a message that names the scene and the problem.
 */
export function computeTimeline(
  meta: TimelineMeta,
  scenes: readonly TimelineScene[],
  known?: readonly string[],
): Timeline {
  const first = scenes[0];
  if (!first) {
    throw new Error('film.scenes is empty');
  }
  const overlap = meta.transition === 'cut' ? 0 : meta.transitionDuration;
  const lead = meta.loop
    ? 0
    : Math.max(0, Math.min(meta.lead ?? DEFAULT_LEAD, first.duration / 3));
  const last = scenes.length - 1;
  let cursor = 0;
  const slots = scenes.map((scene, index): SceneSlot => {
    checkScene(scene, index, overlap, known);
    // The film opens already in motion, so frame 0 is not empty.
    const start = index === 0 ? -lead : cursor - overlap;
    cursor = start + scene.duration;
    const loopOut = meta.loop ? overlap || LOOP_FADE : 0;
    return {
      index,
      start,
      end: cursor,
      duration: scene.duration,
      tin: index > 0 ? overlap : 0,
      tout: index < last ? overlap : loopOut,
    };
  });
  const frames = Math.round(round3(cursor) * meta.fps);
  return {overlap, lead, slots, duration: cursor, frames};
}

/**
 * Tells whether a scene draws at a scene-local time. The last scene also
 * draws at its exact end, so the final frame is not empty.
 * @param local Seconds since the scene started.
 * @param duration Scene length in seconds.
 * @param isLast True for the last scene of the film.
 */
export function isOnScreen(
  local: number,
  duration: number,
  isLast: boolean,
): boolean {
  return local >= 0 && (local < duration || (isLast && local <= duration));
}
