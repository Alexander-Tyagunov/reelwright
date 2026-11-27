/**
 * @fileoverview The checks of `reel plan` that concern labels: reading time,
 * how many are on screen at once, and that their tracks exist.
 */
import type {Check} from './check-types.ts';
import {result} from './check-types.ts';
import {
  BASE_S,
  ENTRANCE_S,
  MAX_LABELS_AT_ONCE,
  onScreen,
  poseStart,
  readingNeed,
  WORD_S,
  words,
} from './timing.ts';
import type {PlanLabel, PlanShot, ShotPlan} from './types.ts';

type Pair = readonly [PlanShot, PlanLabel];

function pairs(shots: readonly PlanShot[]): Pair[] {
  return shots.flatMap(s => s.labels.map(l => [s, l] as const));
}

function posesInside(shots: readonly PlanShot[]): string[] {
  return pairs(shots)
    .filter(([s, l]) => l.to_pose > s.poses)
    .map(
      ([s, l]) =>
        `${s.id} "${l.text}": poses ${l.from_pose}-${l.to_pose} are outside ` +
        `1-${s.poses}`,
    );
}

function tracksListed(shots: readonly PlanShot[]): string[] {
  return pairs(shots)
    .filter(([s, l]) => !s.tracks.includes(l.track))
    .map(
      ([s, l]) => `${s.id} "${l.text}": track "${l.track}" is not in tracks`,
    );
}

/** Reading time of every label, and of the line that goes with it. */
function reading(plan: ShotPlan, shots: readonly PlanShot[]): Check[] {
  const rate = plan.fps_poses;
  const short: string[] = [];
  const tight: string[] = [];
  const lines: string[] = [];
  let ratio = Infinity;
  for (const [s, l] of pairs(shots)) {
    const need = readingNeed(l);
    const on = onScreen(l, rate);
    const n = words(l.text, l.sub, l.line);
    const here = `${s.id} "${l.text}": on screen ${on.toFixed(2)} s`;
    if (on + 1e-9 < need) {
      short.push(`${here}, needs ${need.toFixed(2)} s (${n} words)`);
    } else if (on + 1e-9 < need + ENTRANCE_S) {
      tight.push(
        `${here}, needs ${(need + ENTRANCE_S).toFixed(2)} s with the entrance`,
      );
    }
    ratio = Math.min(ratio, (on - ENTRANCE_S) / need);
    const end = poseStart(l.from_pose, rate) + need + ENTRANCE_S + 0.1;
    if (l.line && end > s.poses / rate + 2e-3) {
      lines.push(
        `${s.id} line "${l.line}": needs until ${end.toFixed(2)} s, the shot ends at ${(s.poses / rate).toFixed(2)} s`,
      );
    }
  }
  const note = `tightest hold/need ${ratio.toFixed(2)}`;
  return [
    result(
      `every label on screen at least ${WORD_S} s per word + ${BASE_S} s`,
      short,
    ),
    result(
      `the same after the ${ENTRANCE_S} s label entrance`,
      tight,
      note,
      'WARN',
    ),
    result('every line fits before its shot ends', lines, '', 'WARN'),
  ];
}

function peakLabels(shot: PlanShot): {peak: number; at: number} {
  let peak = 0;
  let at = 1;
  for (let q = 1; q <= shot.poses; q++) {
    const n = shot.labels.filter(
      l => l.from_pose <= q && q <= l.to_pose,
    ).length;
    if (n > peak) {
      peak = n;
      at = q;
    }
  }
  return {peak, at};
}

function budget(shots: readonly PlanShot[]): Check {
  const bad: string[] = [];
  let top = 0;
  for (const s of shots) {
    const {peak, at} = peakLabels(s);
    top = Math.max(top, peak);
    if (peak > MAX_LABELS_AT_ONCE) {
      bad.push(`${s.id} pose ${at}: ${peak} labels on screen`);
    }
  }
  return result(
    `at most ${MAX_LABELS_AT_ONCE} labels on screen at once`,
    bad,
    `peak ${top}`,
  );
}

/**
 * Runs the label checks.
 *
 * @param shots The shots of the plan, in film order.
 */
export function labelChecks(
  plan: ShotPlan,
  shots: readonly PlanShot[],
): Check[] {
  return [
    result('every label lies inside its shot', posesInside(shots)),
    result(
      "every label track is listed in its shot's tracks",
      tracksListed(shots),
    ),
    ...reading(plan, shots),
    budget(shots),
  ];
}
