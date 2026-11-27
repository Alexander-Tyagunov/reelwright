/**
 * @fileoverview The plate checks of `reel plan`: a missing plate is a
 * warning, because the plan is often checked before the plates exist.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Check} from './check-types.ts';
import {result} from './check-types.ts';
import {chooseFormat, inFormat, plateFolder} from './formats.ts';
import type {PlanShot, ShotPlan} from './types.ts';

function framesOf(file: string): number | null {
  try {
    const frames = (
      JSON.parse(readFileSync(file, 'utf8')) as {frames?: unknown}
    ).frames;
    return typeof frames === 'number' ? frames : null;
  } catch {
    return null;
  }
}

/**
 * Looks for the plate of every shot in every format of the plan.
 *
 * @param root The film folder; plate folders are relative to it.
 */
export function plateChecks(
  plan: ShotPlan,
  shots: readonly PlanShot[],
  root: string,
): Check[] {
  const missing: string[] = [];
  const wrong: string[] = [];
  for (const name of Object.keys(plan.formats)) {
    const format = chooseFormat(plan, name);
    for (const s of shots) {
      const file = join(root, inFormat(plateFolder(s), format), 'tracks.json');
      const frames = existsSync(file) ? framesOf(file) : null;
      if (!existsSync(file)) {
        missing.push(`${s.id} (${name}): ${file} not found`);
      } else if (frames !== s.poses) {
        wrong.push(
          `${s.id} (${name}): ${frames ?? 'no'} frames, the plan has ${s.poses} poses`,
        );
      }
    }
  }
  return [
    result('every plate exists', missing, `looked under ${root}`, 'WARN'),
    result(
      'every plate has as many frames as its shot has poses',
      wrong,
      '',
      'WARN',
    ),
  ];
}
