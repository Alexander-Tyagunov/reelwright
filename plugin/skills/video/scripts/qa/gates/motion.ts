/**
 * @fileoverview The motion gate: frame-to-frame change across the whole
 * video. It fails on a still stretch longer than the film allows, a scene
 * that starts without motion, and a loop whose last frame does not flow into
 * the first. It warns on a mostly still film and on glitch-like jumps.
 */
import type {SceneInfo, TextInfo} from '../../shared/contract.ts';
import type {Freeze, StillRun} from '../freezes.ts';
import {
  abruptFrames,
  deadScenes,
  freezeLimit,
  seamLimit,
  stillMask,
  stillRuns,
  toFreezes,
} from '../freezes.ts';
import {r2, r3, sceneAt, sceneLabel} from '../labels.ts';
import type {DecodedMotion} from '../motion-decode.ts';
import type {Findings, GateResult} from '../report.ts';
import {findings} from '../report.ts';
import {sparkline} from '../sparkline.ts';
import {
  ABRUPT_DIFF,
  BOUNDARY_S,
  DEAD_DIFF,
  FREEZE_DIFF,
  FREEZE_MIN_S,
  FROZEN_RATIO_WARN,
  HOLD_MARGIN_S,
} from '../thresholds.ts';

/** What the motion gate needs to know about the film. */
export interface MotionFilm {
  scenes: SceneInfo[];
  texts: TextInfo[];
  loop: boolean;
  /** Longest still stretch accepted, in seconds. */
  maxHold: number;
}

/** Records each freeze. Returns the total frozen seconds. */
function reportFreezes(
  out: Findings,
  film: MotionFilm,
  freezes: readonly Freeze[],
): number {
  let total = 0;
  for (const z of freezes) {
    total += z.seconds;
    const scene = sceneAt(film, (z.start + z.end) / 2);
    const label = sceneLabel(film, scene);
    const needs = film.texts.filter(t => t.scene === scene).map(t => t.need);
    const need = Math.max(0, ...needs);
    const limit = freezeLimit(film.maxHold, need);
    const span = `${z.start} s to ${z.end} s`;
    if (z.seconds > limit) {
      out.add(
        'FAIL',
        `freeze ${label}: nothing moves from ${span} (${z.seconds} s), ` +
          `longer than the ` +
          `limit of ${limit} s (maxHold ${film.maxHold} s, or the scene's ` +
          `longest reading hold ${r2(need)} s + ${HOLD_MARGIN_S} s). ` +
          `Shorten the scene by ${r2(z.seconds - limit)} s, or reveal its ` +
          'content in more steps',
      );
    } else {
      out.details.push(
        `info freeze ${label}: ${span} (${z.seconds} s, within the ` +
          `limit of ${limit} s)`,
      );
    }
  }
  return total;
}

function reportDead(
  out: Findings,
  film: MotionFilm,
  diffs: readonly number[],
  fps: number,
): number {
  const dead = deadScenes(diffs, film.scenes, fps);
  for (const d of dead) {
    const scene = film.scenes[d.index];
    out.add(
      'FAIL',
      `scene ${d.index + 1} (${scene?.type}) shows no motion in its first ` +
        `${r2(d.to - d.from)} s: max frame difference ${r3(d.maxDiff)}, ` +
        `need > ${DEAD_DIFF} (window ${r2(d.from)} s to ${r2(d.to)} s)`,
    );
  }
  return dead.length;
}

function reportAbrupt(
  out: Findings,
  film: MotionFilm,
  diffs: readonly number[],
  fps: number,
): number {
  const bounds = film.scenes.flatMap(s => [s.start, s.end]);
  const frames = abruptFrames(diffs, fps, bounds);
  for (const i of frames) {
    const t = i / fps;
    out.add(
      'WARN',
      `abrupt change at ${r2(t)} s in ${sceneLabel(film, sceneAt(film, t))}: ` +
        `frame difference ${r2(diffs[i] ?? 0)} > ${ABRUPT_DIFF} and no ` +
        `scene boundary within ${BOUNDARY_S} s (possible glitch or flash)`,
    );
  }
  return frames.length;
}

function reportRatio(out: Findings, frozen: number, seconds: number): number {
  const ratio = frozen / seconds;
  if (ratio > FROZEN_RATIO_WARN) {
    out.add(
      'WARN',
      `frozen ratio ${r2(ratio)}: ${r2(frozen)} s of ${r2(seconds)} s are ` +
        `static, limit ${FROZEN_RATIO_WARN}`,
    );
  }
  return ratio;
}

/** Checks the loop seam. Returns the text for the summary line. */
function reportSeam(
  out: Findings,
  motion: DecodedMotion,
  runs: readonly StillRun[],
): string {
  const {median, limit} = seamLimit(motion.diffs, runs);
  if (motion.seam > limit) {
    out.add(
      'FAIL',
      `loop seam: last frame differs from frame 0 by ${r3(motion.seam)}, ` +
        `limit ${r3(limit)} (1.5 x median motion ${r3(median)} + 0.05). ` +
        'The loop will visibly jump; make the last scene return to the ' +
        "first frame's look",
    );
  }
  return `; seam ${r3(motion.seam)} vs limit ${r3(limit)}`;
}

/**
 * Runs the motion gate on a decoded video. Pure: it reads no file.
 *
 * @param film Scene timing, texts, loop flag and `maxHold`.
 * @param motion Per-frame differences and the loop seam difference.
 * @param fps Frame rate of the video itself. A draft is slower than the film.
 */
export function gateMotion(
  film: MotionFilm,
  motion: DecodedMotion,
  fps: number,
): GateResult {
  const {diffs} = motion;
  const out = findings();
  const runs = stillRuns(stillMask(diffs));
  const freezes = toFreezes(runs, fps);
  const frozen = reportFreezes(out, film, freezes);
  const ratio = reportRatio(out, frozen, diffs.length / fps);
  const dead = reportDead(out, film, diffs, fps);
  const abrupt = reportAbrupt(out, film, diffs, fps);
  const seam = film.loop ? reportSeam(out, motion, runs) : '';
  const sum = diffs.slice(1).reduce((a, b) => a + b, 0);
  const mean = diffs.length > 1 ? sum / (diffs.length - 1) : 0;
  const longest = Math.max(0, ...freezes.map(z => z.seconds));
  return {
    id: 'motion',
    status: out.status,
    summary:
      `${motion.count} frames, mean d ${r3(mean)}; ${freezes.length} ` +
      `freezes >= ${FREEZE_MIN_S} s (longest ${longest} s), frozen ratio ` +
      `${r2(ratio)}; ${dead} dead scenes; ${abrupt} abrupt${seam}`,
    details: out.details,
    sparkline: sparkline(diffs, fps),
    freezes,
    stats: {
      freezeThreshold: FREEZE_DIFF,
      frozenRatio: r3(ratio),
      frames: motion.count,
    },
  };
}
