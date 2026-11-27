/**
 * @fileoverview Builds a film spec from a shot plan, the plates beside it and
 * the optional side files. Pure apart from reading the plates'
 * `tracks.json` of an intro and an outro.
 */
import {join, relative, sep} from 'node:path';
import {UserError} from '../core/errors.ts';
import type {
  AutoSpec,
  Brand,
  FilmMeta,
  FilmSpec,
  SoundSpec,
} from '../shared/contract.ts';
import {chooseFormat} from './formats.ts';
import {allShots} from './parse.ts';
import type {PlateScene} from './scenes.ts';
import {extraScene, shotScene} from './scenes.ts';
import {
  chosenIntensity,
  defaultAuto,
  enginePalette,
  withExtras,
} from './sound.ts';
import type {PlanShot, ShotPlan, SideFiles} from './types.ts';

/** What the `assemble` command asks for. */
export interface AssembleOptions {
  /** Shot ids to include, or null for every shot. */
  shots: string[] | null;
  /** Format name such as `9:16`; undefined for the plan's first format. */
  format?: string;
  /** Intro plate folder, relative to the film folder. */
  intro?: string;
  /** Outro plate folder, relative to the film folder. */
  outro?: string;
  /** Leave `meta.sound` out. */
  noSound: boolean;
  /** The film folder, where the plate folders are found. */
  root: string;
  /** Folder the spec will be written to; plate paths are relative to it.
   * Defaults to `root`. */
  specDir?: string;
}

/** The spec and what to tell the user. */
export interface Assembled {
  spec: FilmSpec;
  /** One sentence each: things that are legal but worth a look. */
  warnings: string[];
}

function chooseShots(plan: ShotPlan, ids: string[] | null): PlanShot[] {
  const shots = allShots(plan);
  const unknown = (ids ?? []).filter(i => !shots.some(s => s.id === i));
  if (unknown.length) {
    throw new UserError(
      `unknown shot ${unknown.join(', ')}. The plan has ` +
        `${shots.map(s => s.id).join(', ')}.`,
    );
  }
  return ids ? shots.filter(s => ids.includes(s.id)) : shots;
}

function unusedWarnings(
  chosen: PlanShot[],
  all: PlanShot[],
  side: SideFiles,
  used: Map<string, Set<string>>,
  extras: string[],
): string[] {
  const out: string[] = [];
  for (const id of Object.keys(side.extraCues)) {
    if (!all.some(s => s.id === id) && !extras.includes(id)) {
      out.push(`extra-cues for unknown shot ${id}`);
    }
  }
  for (const shot of chosen) {
    for (const text of Object.keys(side.overrides[shot.id] ?? {})) {
      if (!used.get(shot.id)?.has(text)) {
        out.push(
          `override for ${shot.id} ${JSON.stringify(text)} matches no label`,
        );
      }
    }
  }
  return out;
}

function checkExtraIds(extraIds: string[], shots: PlanShot[]): void {
  const clash = extraIds.find(
    (id, i) => shots.some(s => s.id === id) || extraIds.indexOf(id) !== i,
  );
  if (clash !== undefined) {
    throw new UserError(
      `the intro or outro "${clash}" has the id of a shot or of the other ` +
        'extra plate, so two scenes would share an id. Rename its folder.',
    );
  }
}

function toSpecDir(scenes: PlateScene[], options: AssembleOptions): void {
  const from = options.specDir ?? options.root;
  for (const scene of scenes) {
    const abs = join(options.root, scene.plate);
    scene.plate = relative(from, abs).split(sep).join('/');
  }
}

function soundMeta(
  plan: ShotPlan,
  chosen: PlanShot[],
  intro: PlateScene | null,
  outro: PlateScene | null,
): SoundSpec {
  const curve = chosenIntensity(plan, chosen);
  return {
    palette: enginePalette(plan.sound),
    intensity: withExtras(curve, intro?.duration ?? 0, outro?.duration ?? 0),
    auto: (plan.sound.auto ?? defaultAuto()) as AutoSpec,
  };
}

/**
 * Builds the film spec. Scenes follow plan order whatever order `shots`
 * names; an intro comes first and an outro last.
 *
 * @param plan A checked plan.
 * @param side The files beside the plan.
 * @throws UserError for an unknown shot or format, an unknown palette, an
 *   intro or outro plate whose `tracks.json` is missing or unusable, or an
 *   intro or outro id that a shot already has.
 */
export function assemble(
  plan: ShotPlan,
  side: SideFiles,
  options: AssembleOptions,
): Assembled {
  const format = chooseFormat(plan, options.format);
  const chosen = chooseShots(plan, options.shots);
  const cx = {rate: plan.fps_poses, format, side};
  const warnings: string[] = [];
  const used = new Map<string, Set<string>>();
  const scenes: PlateScene[] = chosen.map(shot => {
    const built = shotScene(shot, cx);
    warnings.push(...built.warnings);
    used.set(shot.id, built.used);
    return built.scene;
  });
  const intro = options.intro
    ? extraScene(options.intro, options.root, cx)
    : null;
  const outro = options.outro
    ? extraScene(options.outro, options.root, cx)
    : null;
  const extraIds = [intro, outro].flatMap(s => (s ? [s.id] : []));
  checkExtraIds(extraIds, allShots(plan));
  warnings.push(
    ...unusedWarnings(chosen, allShots(plan), side, used, extraIds),
  );
  const names = chosen.map(s => s.id).join(',');
  const meta: FilmMeta = {
    title: `${plan.title} (${names})`,
    width: format.width,
    height: format.height,
    fps: plan.film_fps,
    transition: 'cut',
    lead: 0,
  };
  if (!options.noSound) {
    meta.sound = soundMeta(plan, chosen, intro, outro);
  }
  const all = [...(intro ? [intro] : []), ...scenes, ...(outro ? [outro] : [])];
  toSpecDir(all, options);
  const spec: FilmSpec = {meta, scenes: all as FilmSpec['scenes']};
  if (side.brand) {
    spec.brand = side.brand as Brand;
  }
  return {spec, warnings};
}
