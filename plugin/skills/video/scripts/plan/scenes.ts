/**
 * @fileoverview Builds the plate scenes of a film spec: one per shot of the
 * plan, and one for an intro or outro plate that is not in the plan.
 */
import {existsSync, readFileSync} from 'node:fs';
import {basename, join} from 'node:path';
import {UserError} from '../core/errors.ts';
import type {Plate} from '../shared/plate.ts';
import {parsePlate} from '../shared/plate.ts';
import type {SceneCueOut} from './cue-list.ts';
import {cueList} from './cue-list.ts';
import type {PlanFormat} from './formats.ts';
import {inFormat, plateFolder} from './formats.ts';
import {sceneLabels} from './scene-labels.ts';
import {r4} from './timing.ts';
import type {PlanShot, SideFiles} from './types.ts';

/** A plate scene as written into the spec. */
export type PlateScene = {
  type: 'plate';
  id: string;
  /** Seconds on screen. */
  duration: number;
  /** Path of `tracks.json`, relative to the film folder. */
  plate: string;
  labels: Record<string, unknown>[];
  texts?: Record<string, unknown>[];
  /** Title of the chapter that starts with this scene. */
  chapter?: string;
  cues: SceneCueOut[];
};

/** A scene and the warnings its building raised. */
export interface BuiltScene {
  scene: PlateScene;
  warnings: string[];
  /** Label texts of this shot whose override was used. */
  used: Set<string>;
}

/** What shot scenes need from the plan and the files beside it. */
export interface SceneContext {
  rate: number;
  format: PlanFormat;
  side: SideFiles;
}

/**
 * Builds the scene of one shot.
 *
 * @param shot A shot of the plan.
 */
export function shotScene(shot: PlanShot, cx: SceneContext): BuiltScene {
  const parts = sceneLabels(shot, cx.side.overrides[shot.id] ?? {}, cx.rate);
  const folder = inFormat(plateFolder(shot), cx.format);
  const scene: PlateScene = {
    type: 'plate',
    id: shot.id,
    duration: r4(shot.poses / cx.rate),
    plate: `${folder}/tracks.json`,
    labels: parts.labels,
    cues: [],
  };
  if (parts.texts.length) {
    scene.texts = parts.texts;
  }
  if (shot.chapter) {
    scene.chapter = shot.chapter;
  }
  const extra = cx.side.extraCues[shot.id] ?? [];
  scene.cues = cueList(cx.rate, shot.cues, extra);
  return {scene, warnings: parts.warnings, used: parts.used};
}

function readTracks(file: string): Plate {
  try {
    return parsePlate(JSON.parse(readFileSync(file, 'utf8')));
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new UserError(`${file} cannot be used: ${why}`);
  }
}

/**
 * Builds the scene of a plate that is not in the plan, such as an intro or an
 * outro. It has no labels; its cues come from `extra-cues.json` and its texts
 * from `outro-texts.json`, both keyed by the plate folder's name.
 *
 * @param folder Plate folder, relative to the film folder.
 * @param root The film folder, where `<folder>/tracks.json` is read.
 * @throws UserError when `tracks.json` is missing, is not JSON, or lacks a
 *   field the plate reader needs; the message names the file and the field.
 */
export function extraScene(
  folder: string,
  root: string,
  cx: SceneContext,
): PlateScene {
  const dir = inFormat(folder, cx.format);
  const id = basename(folder.replace(/\/+$/, '')).replace(cx.format.suffix, '');
  const file = join(root, dir, 'tracks.json');
  if (!existsSync(file)) {
    throw new UserError(
      `${file} not found. Render the plate "${id}" first, or leave out ` +
        'the --intro or --outro flag that names it.',
    );
  }
  const tracks = readTracks(file);
  const scene: PlateScene = {
    type: 'plate',
    id,
    duration: r4(tracks.frames / tracks.fps),
    plate: `${dir}/tracks.json`,
    labels: [],
    cues: cueList(cx.rate, cx.side.extraCues[id] ?? []),
  };
  const texts = cx.side.outroTexts[id];
  if (texts?.length) {
    scene.texts = texts;
  }
  return scene;
}
