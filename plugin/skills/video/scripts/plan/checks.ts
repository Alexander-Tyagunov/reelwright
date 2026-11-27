/**
 * @fileoverview The checks of `reel plan`: totals, events and cues inside
 * their shots, the intensity curve, and the label checks. The schema itself
 * is checked when the plan is read.
 */

import {labelChecks} from './check-labels.ts';
import {plateChecks} from './check-plates.ts';
import type {Check} from './check-types.ts';
import {result} from './check-types.ts';
import {allShots} from './parse.ts';
import type {PlanShot, ShotPlan} from './types.ts';

function totals(plan: ShotPlan, shots: readonly PlanShot[]): Check {
  const poses = shots.reduce((n, s) => n + s.poses, 0);
  const seconds = poses / plan.fps_poses;
  const bad: string[] = [];
  if (plan.total_poses !== undefined && plan.total_poses !== poses) {
    bad.push(
      `total_poses says ${plan.total_poses}, the shots add up to ${poses}`,
    );
  }
  const said = (plan as {total_seconds?: unknown}).total_seconds;
  if (typeof said === 'number' && Math.abs(said - seconds) > 0.01) {
    bad.push(
      `total_seconds says ${said}, the shots add up to ${seconds.toFixed(3)}`,
    );
  }
  return result(
    'totals agree with the shots',
    bad,
    `${poses} poses = ${seconds.toFixed(2)} s at ${plan.fps_poses} poses a second`,
  );
}

function inside(shots: readonly PlanShot[]): Check {
  const bad: string[] = [];
  for (const s of shots) {
    for (const e of s.events) {
      if (e.pose > s.poses) {
        bad.push(`${s.id}: event ${e.name} at pose ${e.pose}`);
      }
    }
    for (const c of s.cues) {
      if (c.pose > s.poses) {
        bad.push(`${s.id}: cue ${c.kind} at pose ${c.pose}`);
      }
    }
  }
  const cues = shots.reduce((n, s) => n + s.cues.length, 0);
  return result('events and cues lie inside their shots', bad, `${cues} cues`);
}

function curve(plan: ShotPlan, shots: readonly PlanShot[]): Check {
  const seconds = shots.reduce((n, s) => n + s.poses, 0) / plan.fps_poses;
  const pts = plan.sound.intensity;
  const bad: string[] = [];
  if (pts.some(p => p.value < 0 || p.value > 1)) {
    bad.push('a value lies outside 0 to 1');
  }
  if (pts.some(p => p.at_s < 0 || p.at_s > seconds + 0.01)) {
    bad.push(`a point lies outside the film (0 to ${seconds.toFixed(2)} s)`);
  }
  if (pts.some((p, i) => i > 0 && p.at_s < (pts[i - 1]?.at_s ?? 0))) {
    bad.push('points must rise in time');
  }
  return result('intensity curve is valid', bad, `${pts.length} points`);
}

/**
 * Runs every check of a plan.
 *
 * @param root The film folder, where plates are looked for.
 */
export function checkPlan(plan: ShotPlan, root: string): Check[] {
  const shots = allShots(plan);
  return [
    result('schema', [], `${shots.length} shots`),
    totals(plan, shots),
    inside(shots),
    curve(plan, shots),
    ...labelChecks(plan, shots),
    ...plateChecks(plan, shots, root),
  ];
}
