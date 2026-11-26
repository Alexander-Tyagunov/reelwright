/**
 * @fileoverview Draws every scene at a few moments to find a scene whose
 * frame code throws. The load gate reports what it finds, so the failure is
 * blamed on the scene and not on whichever gate drew the frame first.
 */
import type {CdpSession} from '../browser/cdp.ts';
import {drawAt} from '../browser/film.ts';
import type {FilmInfo, SceneInfo} from '../shared/contract.ts';
import {r3} from './labels.ts';

/** Film times to draw for one scene: start, rest time and last frame. */
function drawTimes(scene: SceneInfo, info: FilmInfo): number[] {
  const last = Math.max(0, info.duration - 1 / info.fps);
  const within = (t: number) => r3(Math.min(Math.max(t, 0), last));
  const end = scene.end - 1 / info.fps;
  return [...new Set([scene.start, scene.check, end].map(within))];
}

/**
 * Draws each scene at its start, at its rest time and one frame before its
 * end. Stops at the first failing time of a scene.
 *
 * @param page A page that shows the film.
 * @param info The film's timing.
 * @returns One message per scene that failed, in scene order. A scene's own
 *   message names the scene and the time.
 */
export async function findDrawFailures(
  page: CdpSession,
  info: FilmInfo,
): Promise<string[]> {
  const out: string[] = [];
  for (const scene of info.scenes) {
    for (const t of drawTimes(scene, info)) {
      try {
        await drawAt(page, t);
      } catch (e) {
        out.push(e instanceof Error ? e.message : String(e));
        break;
      }
    }
  }
  return out;
}
