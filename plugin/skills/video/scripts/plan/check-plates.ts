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

interface Counts {
  frames: number | null;
  fps: number | null;
}

function countsOf(file: string): Counts {
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<
      string,
      unknown
    >;
    return {
      frames: typeof doc.frames === 'number' ? doc.frames : null,
      fps: typeof doc.fps === 'number' ? doc.fps : null,
    };
  } catch {
    return {frames: null, fps: null};
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
  const slow: string[] = [];
  for (const name of Object.keys(plan.formats)) {
    const format = chooseFormat(plan, name);
    for (const s of shots) {
      const file = join(root, inFormat(plateFolder(s), format), 'tracks.json');
      if (!existsSync(file)) {
        missing.push(`${s.id} (${name}): ${file} not found`);
        continue;
      }
      const {frames, fps} = countsOf(file);
      if (frames !== s.poses) {
        wrong.push(
          `${s.id} (${name}): ${frames ?? 'no'} frames, the plan has ${s.poses} poses`,
        );
      }
      if (fps !== null && fps !== plan.fps_poses) {
        slow.push(
          `${s.id} (${name}): the plate runs at ${fps} frames a second, ` +
            `the plan at ${plan.fps_poses} poses a second`,
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
    result(
      'every plate runs at the plan pose rate',
      slow,
      `${plan.fps_poses} poses a second`,
      'WARN',
    ),
  ];
}
