/**
 * @fileoverview Turns the labels of one shot into the `labels` and `texts` of
 * a plate scene. Words come from the plan untouched. Placement comes from the
 * plan's label fields, then from `label-overrides.json`, which wins.
 */
import {BASE_S, ENTRANCE_S, poseStart, r4, WORD_S, words} from './timing.ts';
import type {LabelOverride, PlanLabel, PlanShot} from './types.ts';

/** Upward step in `u` for each extra line shown at the same time. */
export const LINE_STACK_STEP = 6;

const LINE_DEFAULTS = {class: 'rw-sub', x: 6, y: 86, align: 'left'};

/** The labels and free texts of one scene, and what to tell the user. */
export interface SceneLabels {
  labels: Record<string, unknown>[];
  texts: Record<string, unknown>[];
  warnings: string[];
  /** Label texts whose override was used. */
  used: Set<string>;
}

type Rec = Record<string, unknown>;

function labelOf(lb: PlanLabel, o: LabelOverride, rate: number): Rec {
  const from = poseStart(lb.from_pose, rate);
  const to = lb.to_pose / rate;
  const out: Rec = {
    track: lb.track,
    text: lb.text,
    sub: lb.sub,
    from: r4((o.from as number | undefined) ?? from),
    to: r4((o.to as number | undefined) ?? to),
    side: o.side ?? lb.side ?? 'auto',
    offset: o.offset ?? lb.offset ?? 5,
    smooth: o.smooth ?? lb.smooth ?? 0.6,
    variant: o.variant ?? 'tag',
  };
  if ('follow' in o || lb.follow !== undefined) {
    out.follow = o.follow ?? lb.follow;
  }
  return out;
}

function lineOf(lb: PlanLabel, label: Rec, o: LabelOverride, dur: number) {
  const lo = o.line ?? {};
  const need = words(lb.text, lb.sub, lb.line) * WORD_S + BASE_S;
  const from = (lo.from as number | undefined) ?? (label.from as number);
  const longest = Math.max(label.to as number, from + need + ENTRANCE_S + 0.1);
  const to = (lo.to as number | undefined) ?? longest;
  let warning: string | null = null;
  if (to > dur + 2e-3) {
    warning =
      `${lb.line}: reading time needs ${to.toFixed(2)} s but the shot ends ` +
      `at ${dur.toFixed(2)}`;
  }
  const rest = Object.fromEntries(
    Object.entries(lo).filter(([k]) => k !== 'from' && k !== 'to'),
  );
  const text = {
    ...LINE_DEFAULTS,
    ...rest,
    text: lb.line,
    from: r4(from),
    to: r4(Math.min(to, dur)),
  };
  return {text, warning};
}

function overlapping(placed: Rec[], t: Rec): number {
  const [a, b] = [t.from as number, t.to as number];
  return placed.filter(p => (p.from as number) < b && a < (p.to as number))
    .length;
}

function stackLines(
  shot: PlanShot,
  texts: Rec[],
  sov: Record<string, LabelOverride>,
) {
  const placed: Rec[] = [];
  for (const t of texts) {
    const n = overlapping(placed, t);
    const placedByHand = shot.labels.some(
      l => l.line === t.text && Object.hasOwn(sov[l.text]?.line ?? {}, 'y'),
    );
    if (n && !placedByHand) {
      t.y = (t.y as number) - LINE_STACK_STEP * n;
    }
    placed.push(t);
  }
}

/**
 * Builds the labels and texts of a shot.
 *
 * @param shot The plan's shot.
 * @param sov Overrides of this shot, by label text.
 * @param rate Poses per second.
 */
export function sceneLabels(
  shot: PlanShot,
  sov: Record<string, LabelOverride>,
  rate: number,
): SceneLabels {
  const out: SceneLabels = {
    labels: [],
    texts: [],
    warnings: [],
    used: new Set(),
  };
  const dur = shot.poses / rate;
  for (const lb of shot.labels) {
    const o = sov[lb.text] ?? {};
    if (sov[lb.text]) {
      out.used.add(lb.text);
    }
    const label = labelOf(lb, o, rate);
    const planned = lb.to_pose / rate - poseStart(lb.from_pose, rate);
    if ((label.to as number) - (label.from as number) < planned - 2e-3) {
      out.warnings.push(
        `${shot.id} ${JSON.stringify(lb.text)}: override shortens the label ` +
          `below the plan (${planned.toFixed(2)} s)`,
      );
    }
    out.labels.push(label);
    if (lb.line) {
      const {text, warning} = lineOf(lb, label, o, dur);
      out.texts.push(text);
      if (warning) {
        out.warnings.push(`${shot.id} line ${warning}`);
      }
    }
  }
  stackLines(shot, out.texts, sov);
  return out;
}
