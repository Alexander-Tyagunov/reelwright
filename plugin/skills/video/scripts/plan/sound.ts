/**
 * @fileoverview Builds `meta.sound` of a film spec from the plan's `sound`
 * block: the intensity curve cut to the shots that are used, shifted for an
 * intro, and closed after an outro.
 */
import {DEFAULT_PALETTE, PALETTE_NAMES} from '../audio/palettes.ts';
import {UserError} from '../core/errors.ts';
import {r4} from './timing.ts';
import type {PlanSound} from './types.ts';

/** Level of the bed under an intro and after the end of an outro. */
export const QUIET_LEVEL = 0.02;

/** Strength of the whoosh the engine adds at each cut, 0 to 1. */
export const CUT_WHOOSH = 0.35;

/** A point of a film's intensity curve: `at` is in film seconds. */
export interface CurvePointOut {
  at: number;
  value: number;
}

function valueAt(pts: ReadonlyArray<readonly [number, number]>, t: number) {
  const first = pts[0] as readonly [number, number];
  const last = pts[pts.length - 1] as readonly [number, number];
  if (t <= first[0]) {
    return first[1];
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, va] = pts[i] as readonly [number, number];
    const [b, vb] = pts[i + 1] as readonly [number, number];
    if (a <= t && t <= b) {
      return b === a ? va : va + ((vb - va) * (t - a)) / (b - a);
    }
  }
  return last[1];
}

/**
 * Cuts the plan's curve to the span from `t0` to `t1` and starts it at 0.
 * The curve is interpolated at both ends so it keeps its shape.
 *
 * @param t0 Plan time of the first used shot's start, in seconds.
 * @param t1 Plan time of the last used shot's end, in seconds.
 */
export function rebaseIntensity(
  points: PlanSound['intensity'],
  t0: number,
  t1: number,
): CurvePointOut[] {
  const pts = points
    .map(p => [p.at_s, p.value] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const inner = pts.filter(([t]) => t0 < t && t < t1);
  const all = [
    [t0, valueAt(pts, t0)] as const,
    ...inner,
    [t1, valueAt(pts, t1)] as const,
  ];
  return all.map(([t, v]) => ({at: r4(t - t0), value: r4(v)}));
}

/**
 * Shifts the curve by the intro's length and closes it after an outro. The
 * bed starts quiet under the intro, reaches the plan's first value when the
 * first shot starts, and eases to the quiet level at the very end.
 *
 * @param intro Seconds of the intro, or 0 for none.
 * @param outro Seconds of the outro, or 0 for none.
 */
export function withExtras(
  points: CurvePointOut[],
  intro: number,
  outro: number,
): CurvePointOut[] {
  const pts = points.map(p => ({at: r4(p.at + intro), value: p.value}));
  if (intro) {
    pts.unshift({at: 0, value: QUIET_LEVEL});
  }
  const last = pts[pts.length - 1];
  const before = pts[pts.length - 2];
  if (outro && last) {
    const end = last.at + outro;
    if (before && last.at === before.at) {
      last.at = r4(last.at - 0.0002);
    }
    pts.push({at: r4(end), value: QUIET_LEVEL});
  }
  return pts;
}

/**
 * Names the engine palette of a plan.
 *
 * @throws UserError when the plan names a palette the engine lacks.
 */
export function enginePalette(sound: PlanSound): string {
  const name = sound.engine_palette ?? DEFAULT_PALETTE;
  if (!PALETTE_NAMES.includes(name)) {
    throw new UserError(
      `sound.engine_palette "${name}" is not a palette. ` +
        `Choose one of: ${PALETTE_NAMES.join(', ')}`,
    );
  }
  return name;
}

/** The default derived cues: a quiet whoosh at a cut and no ending chime. */
export function defaultAuto(): Record<string, unknown> {
  return {transition: CUT_WHOOSH, ending: false};
}
