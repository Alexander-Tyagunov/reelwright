/**
 * @fileoverview Reads a plan file and the optional files beside it:
 * `label-overrides.json`, `extra-cues.json`, `outro-texts.json` and
 * `brand.json`.
 */
import {existsSync, readFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {UserError} from '../core/errors.ts';
import {checkCue, parsePlan} from './parse.ts';
import type {Raw} from './problems.ts';
import {isRaw, problems} from './problems.ts';
import type {ExtraCues, ShotPlan, SideFiles} from './types.ts';

/** A plan read from disk. */
export interface LoadedPlan {
  /** Absolute path of the plan file. */
  abs: string;
  /** Absolute path of the folder that holds the plan and its side files. */
  dir: string;
  plan: ShotPlan;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new UserError(`${path} is not valid JSON: ${why}`);
  }
}

/**
 * Reads and checks a shot plan.
 *
 * @param path Path of the plan, absolute or relative to the working folder.
 * @throws UserError when the path is missing, the file is absent or is not
 *   JSON, or a field the engine reads is wrong.
 */
export function loadPlan(path: string | undefined): LoadedPlan {
  if (!path) {
    throw new UserError('missing plan path, e.g. plan/shots.json');
  }
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new UserError(`plan not found: ${abs}`);
  }
  return {abs, dir: dirname(abs), plan: parsePlan(readJson(abs), abs)};
}

/**
 * Finds the film folder, where `plates/` lies. An explicit folder wins; else
 * the folder above a plan folder called `plan`, else the plan's own folder.
 *
 * @param planDir Absolute folder of the plan.
 * @param given The `--root` flag, if any.
 */
export function filmRoot(planDir: string, given?: string): string {
  if (given) {
    return resolve(given);
  }
  return basename(planDir) === 'plan' ? dirname(planDir) : planDir;
}

function optional(dir: string, name: string): Raw {
  const path = join(dir, name);
  if (!existsSync(path)) {
    return {};
  }
  const doc = readJson(path);
  if (!isRaw(doc)) {
    throw new UserError(`${path} must be a JSON object keyed by shot id`);
  }
  return doc;
}

function checkExtra(cues: Raw, file: string): ExtraCues {
  const p = problems();
  for (const [id, list] of Object.entries(cues)) {
    if (!Array.isArray(list)) {
      p.add(id, 'must be a list of {pose, kind, gain}');
      continue;
    }
    for (const [i, cue] of list.entries()) {
      checkCue(p, `${id}[${i}]`, cue);
    }
  }
  p.throwIfAny(file, 'Correct the file, then run the command again.');
  return cues as ExtraCues;
}

function brandOf(dir: string): Raw | null {
  const path = join(dir, 'brand.json');
  if (!existsSync(path)) {
    return null;
  }
  const doc = readJson(path);
  const brand = isRaw(doc) && isRaw(doc.brand) ? doc.brand : doc;
  if (!isRaw(brand)) {
    throw new UserError(`${path} must hold the brand object of a film spec`);
  }
  return brand;
}

/**
 * Reads the optional files beside a plan. A missing file is an empty one.
 *
 * @param dir Folder of the plan.
 * @throws UserError when a file is not JSON or has the wrong shape.
 */
export function loadSideFiles(dir: string): SideFiles {
  return {
    overrides: optional(dir, 'label-overrides.json') as SideFiles['overrides'],
    extraCues: checkExtra(
      optional(dir, 'extra-cues.json'),
      join(dir, 'extra-cues.json'),
    ),
    outroTexts: optional(dir, 'outro-texts.json') as SideFiles['outroTexts'],
    brand: brandOf(dir),
  };
}
