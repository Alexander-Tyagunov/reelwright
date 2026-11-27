/**
 * @fileoverview Reads a plan file and the optional files beside it:
 * `label-overrides.json`, `extra-cues.json`, `outro-texts.json` and
 * `brand.json`.
 */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {CUE_KINDS} from '../audio/scene-cues.ts';
import {UserError} from '../core/errors.ts';
import {parsePlan} from './parse.ts';
import type {Raw} from './problems.ts';
import {isRaw} from './problems.ts';
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
  for (const [id, list] of Object.entries(cues)) {
    const bad = (Array.isArray(list) ? list : []).find(
      c => !isRaw(c) || !CUE_KINDS.includes(c.kind as never),
    );
    if (!Array.isArray(list) || bad !== undefined) {
      throw new UserError(
        `${file}: the cues of ${id} must be a list of {pose, kind, gain} ` +
          `with a kind from ${CUE_KINDS.join(', ')}. Correct the file.`,
      );
    }
  }
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
    extraCues: checkExtra(optional(dir, 'extra-cues.json'), 'extra-cues.json'),
    outroTexts: optional(dir, 'outro-texts.json') as SideFiles['outroTexts'],
    brand: brandOf(dir),
  };
}
