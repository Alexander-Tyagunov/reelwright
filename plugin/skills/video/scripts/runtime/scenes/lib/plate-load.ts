/**
 * @fileoverview Loads the plate of a `plate` scene before the scene is built:
 * reads and checks `tracks.json`, confirms the first and last frame files
 * exist, and records a warning when the plate is shorter than the scene.
 * Seconds unless a name says otherwise.
 */

import type {SceneSpec} from '../../../shared/contract.ts';
import type {Plate} from '../../../shared/plate.ts';
import {parsePlate, plateFramePath} from '../../../shared/plate.ts';
import {messageOf} from '../../errors.ts';
import {addWarning} from '../../warnings.ts';
import type {PlateOptions} from './plate-spec.ts';
import {bindPlate, parsePlateOptions} from './plate-spec.ts';

/** A plate that was loaded for one scene. */
export interface LoadedPlate {
  plate: Plate;
  options: PlateOptions;
}

const loaded = new Map<number, LoadedPlate>();

/** Encodes a project path for a request, keeping its `/` separators. */
export function addressOf(path: string): string {
  return encodeURI(path).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

async function fetchTracks(path: string): Promise<unknown> {
  const res = await fetch(addressOf(path));
  if (!res.ok) {
    throw new Error(
      `plate file not found: ${path}. Check "plate" in the scene: the ` +
        'path is relative to the folder that holds film.json.',
    );
  }
  try {
    return await res.json();
  } catch {
    throw new Error(
      `${path} is not valid JSON. Export the tracks again from the 3D scene.`,
    );
  }
}

async function requireFile(file: string, which: string): Promise<void> {
  const res = await fetch(addressOf(file), {method: 'HEAD'});
  if (!res.ok) {
    throw new Error(
      `the ${which} frame file is missing: ${file}. Render the plate again ` +
        'or fix frame_pattern and first in tracks.json.',
    );
  }
}

/**
 * Loads and checks the plate of one scene and keeps it for the factory.
 *
 * @param scene The scene entry.
 * @param index Zero-based scene number.
 * @throws Error that says what is wrong and what to do: a missing file, a
 *   bad `tracks.json`, an unknown track or event, or a missing frame.
 */
export async function loadPlate(
  scene: SceneSpec,
  index: number,
): Promise<void> {
  const options = parsePlateOptions(scene);
  const raw = await fetchTracks(options.plate);
  let plate: Plate;
  try {
    plate = parsePlate(raw);
  } catch (err) {
    throw new Error(`${options.plate}: ${messageOf(err)}`);
  }
  bindPlate(options, plate, scene.duration);
  await requireFile(plateFramePath(plate, options.plate, 0), 'first');
  const last = plateFramePath(plate, options.plate, plate.frames - 1);
  await requireFile(last, 'last');
  const length = plate.frames / plate.fps - options.start;
  if (scene.duration > length + 1e-6) {
    addWarning(
      `scene ${index + 1} (plate): the plate has ${length.toFixed(2)} s ` +
        `after start but the scene lasts ${scene.duration} s, so the last ` +
        `frame holds for ${(scene.duration - length).toFixed(2)} s. ` +
        'Shorten the scene or render more frames.',
    );
  }
  loaded.set(index, {plate, options});
}

/**
 * Gives the plate loaded for a scene.
 * @param index Zero-based scene number.
 * @throws Error when the scene was not preloaded.
 */
export function loadedPlate(index: number): LoadedPlate {
  const found = loaded.get(index);
  if (!found) {
    throw new Error('the plate was not loaded before the scene was built');
  }
  return found;
}
