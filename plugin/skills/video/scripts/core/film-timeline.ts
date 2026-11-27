/**
 * @fileoverview Scene start times of a film spec, worked out without opening
 * a page. It applies the same defaults and the same arithmetic as the film
 * page, so a start time here equals `FilmInfo.scenes[i].start`.
 */

import type {Timeline} from '../runtime/timeline.ts';
import {computeTimeline} from '../runtime/timeline.ts';
import type {FilmSpec} from '../shared/contract.ts';
import {UserError} from './errors.ts';

/** Frame rate when the spec names none. */
const DEFAULT_FPS = 30;

/** Seconds two scenes overlap in a fade when the spec names none. */
const DEFAULT_OVERLAP_S = 0.45;

/**
 * Computes the timeline of a spec.
 *
 * @returns Slots in seconds from the first frame of the film, the total
 *   length in seconds and the frame count.
 * @throws UserError when a scene has no duration, a scene is shorter than
 *   its transitions, or the film has no scenes.
 */
export function filmTimeline(film: FilmSpec): Timeline {
  const meta = film.meta ?? {};
  try {
    return computeTimeline(
      {
        transition: meta.transition ?? 'fade',
        transitionDuration: meta.transitionDuration ?? DEFAULT_OVERLAP_S,
        loop: meta.loop ?? false,
        lead: meta.lead,
        fps: meta.fps ?? DEFAULT_FPS,
      },
      film.scenes ?? [],
    );
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new UserError(`${why}. Correct the scene durations in the spec.`);
  }
}
