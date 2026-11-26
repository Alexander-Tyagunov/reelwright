/**
 * @fileoverview Scene preparation that needs the network. A scene type
 * registers a preloader; `runPreloads` runs it for each scene of the film
 * before any scene factory runs, because a factory cannot wait.
 */

import type {FilmSpec, SceneSpec} from '../shared/contract.ts';
import {messageOf} from './errors.ts';

/** Loads and checks what one scene needs. Throws an `Error` to fail. */
export type Preloader = (scene: SceneSpec, index: number) => Promise<void>;

const preloaders = new Map<string, Preloader>();

/**
 * Registers the preloader of a scene type.
 * @param type Value of `type` in the spec.
 * @param fn Runs once for each scene of that type.
 */
export function registerPreload(type: string, fn: Preloader): void {
  preloaders.set(type, fn);
}

/**
 * Runs the preloaders of the film's scenes, in scene order.
 * @param film The film spec.
 * @throws Error that names the scene number and type, then the cause.
 */
export async function runPreloads(film: FilmSpec): Promise<void> {
  for (const [index, scene] of film.scenes.entries()) {
    const preload = preloaders.get(scene.type);
    if (!preload) {
      continue;
    }
    try {
      await preload(scene, index);
    } catch (err) {
      throw new Error(`scene ${index + 1} (${scene.type}): ${messageOf(err)}`);
    }
  }
}
