/**
 * @fileoverview The table of scene types. Built-in scenes register here when
 * their module loads. Project scenes register through `Reel.scene`.
 */

import type {SceneFactory} from './types.ts';

const scenes = new Map<string, SceneFactory>();
const files = new Map<string, string>();

/**
 * Registers a scene type. A second registration of the same type replaces the
 * first, so a project can override a built-in scene.
 * @param type Value of `type` in the spec, for example `'title'`.
 * @param factory Builds the scene once and declares its motion.
 * @param file Project script that registers the type, for error messages.
 *   Leave out for a built-in scene.
 */
export function registerScene(
  type: string,
  factory: SceneFactory,
  file?: string,
): void {
  scenes.set(type, factory);
  if (file) {
    files.set(type, file);
  } else {
    files.delete(type);
  }
}

/**
 * Finds the project script that registered a scene type.
 * @param type Value of `type` in the spec.
 * @returns The path as written in `customScenes`, or `undefined` for a
 *   built-in scene.
 */
export function sceneFile(type: string): string | undefined {
  return files.get(type);
}

/**
 * Finds the factory of a scene type.
 * @param type Value of `type` in the spec.
 * @returns The factory, or `undefined` for an unknown type.
 */
export function getScene(type: string): SceneFactory | undefined {
  return scenes.get(type);
}

/** Names of all registered scene types, in registration order. */
export function sceneTypes(): string[] {
  return [...scenes.keys()];
}
