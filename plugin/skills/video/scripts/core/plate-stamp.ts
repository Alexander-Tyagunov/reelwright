/**
 * @fileoverview Fingerprints of plate scenes. A plate is a `tracks.json` and
 * hundreds of frame files, so the fingerprint hashes the json and takes the
 * size and modification time of each frame file, and never reads the frames.
 */
import {readFileSync, statSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import type {FilmSpec, SceneSpec} from '../shared/contract.ts';
import {parsePlate, plateFramePath} from '../shared/plate.ts';
import {sha1} from './hash.ts';

function frameEntry(path: string): string {
  try {
    const st = statSync(path);
    return `${st.size}:${st.mtimeMs}`;
  } catch {
    return 'missing';
  }
}

/**
 * Fingerprints the plate of one scene.
 *
 * @param dir Absolute project folder. A plate outside it is not read.
 * @param scene A scene entry.
 * @returns 40 hex characters that change when `tracks.json` or any frame
 *   file changes, or `null` when the scene is not a plate scene.
 */
export function plateFingerprint(dir: string, scene: SceneSpec): string | null {
  const rel = scene.plate;
  if (scene.type !== 'plate' || typeof rel !== 'string') {
    return null;
  }
  const file = resolve(dir, rel);
  if (!file.startsWith(dir + sep)) {
    return sha1('outside', rel);
  }
  try {
    const bytes = readFileSync(file);
    const plate = parsePlate(JSON.parse(bytes.toString('utf8')));
    const entries = Array.from({length: plate.frames}, (_, i) =>
      frameEntry(resolve(dir, plateFramePath(plate, rel, i))),
    );
    return sha1(bytes, entries.join('|'));
  } catch {
    return sha1('unreadable', rel, frameEntry(file));
  }
}

/**
 * Fingerprints every plate scene of a film, one entry per scene.
 *
 * @returns One value per scene, in order; `null` for scenes that are not
 *   plates.
 */
export function plateFingerprints(
  dir: string,
  film: FilmSpec,
): Array<string | null> {
  return film.scenes.map(s => plateFingerprint(dir, s));
}
