/**
 * @fileoverview Labels of a `plate` scene: boxes of text that follow a
 * tracked point, with an optional leader line and dot. The box position is a
 * pure function of the plate frame, so it stays locked to the picture.
 * Sizes are in `u` and pixels as named; times are scene-local seconds.
 */

import type {Plate, PlatePoint} from '../../../shared/plate.ts';
import {plateFrameAt} from '../../../shared/plate.ts';
import {round3} from '../../math.ts';
import type {SceneContext} from '../../types.ts';
import type {Point, Rect, Side} from './plate-place.ts';
import {chooseSide, leaderEnd, placeLabel, toFrame} from './plate-place.ts';
import type {BoundLabel} from './plate-spec.ts';

/** Seconds a label takes to fade in, and to fade out before its `to`. */
export const FADE_S = 0.35;
/** Distance in `u` that a label slides while it fades in. */
const SLIDE_U = 2;
/** Radius in `u` of the dot on the point. */
const DOT_U = 0.55;
/** Width in `u` of the leader line. */
const LEADER_U = 0.16;

/** What the labels need to know about the plate and the frame. */
export interface PlateGeometry {
  plate: Plate;
  /** Seconds into the plate at which the scene starts. */
  start: number;
  /** Where the plate image is drawn, in frame pixels. */
  drawn: Rect;
  /** The safe area, in frame pixels. */
  area: Rect;
}

/** Where one label is at one plate frame. */
interface Placed {
  point: Point;
  box: Rect;
  visible: boolean;
}

const SLIDE_AXIS: Record<Side, Point> = {
  right: {x: 1, y: 0},
  left: {x: -1, y: 0},
  top: {x: 0, y: -1},
  bottom: {x: 0, y: 1},
};

function buildBox(ctx: SceneContext, l: BoundLabel) {
  const {h} = ctx;
  const style = {
    position: 'absolute',
    left: '0',
    top: '0',
    width: 'max-content',
    maxWidth: 'calc(var(--u) * 34)',
    opacity: '0',
    ...(l.variant === 'tag'
      ? {
          padding: 'calc(var(--u) * 1) calc(var(--u) * 1.6)',
          background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
          border: 'calc(var(--u) * 0.14) solid var(--line)',
          borderRadius: 'calc(var(--u) * 1.2)',
        }
      : {textShadow: '0 0 calc(var(--u) * 0.8) var(--bg)'}),
  };
  const name = ctx.text('div', 'rw-body', l.text, {
    style: {fontWeight: '650'},
  });
  const sub = l.sub
    ? ctx.text('div', 'rw-small', l.sub, {style: {color: 'var(--muted)'}})
    : null;
  const box = h('div', {style}, name, sub);
  return {box, texts: sub ? [name, sub] : [name]};
}

function trackOf(plate: Plate, name: string): PlatePoint {
  const point = plate.points[name];
  if (!point) {
    throw new Error(`the plate has no track "${name}"`);
  }
  return point;
}

function averagePoint(point: PlatePoint, f0: number, f1: number) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let f = f0; f <= f1; f++) {
    if ((point.visible[f] ?? 0) > 0) {
      n++;
      sx += point.x[f] ?? 0;
      sy += point.y[f] ?? 0;
    }
  }
  return n
    ? {x: sx / n, y: sy / n}
    : {x: point.x[f0] ?? 0, y: point.y[f0] ?? 0};
}

/** Chooses the side once from the point's average place on screen. */
function sideOf(geo: PlateGeometry, l: BoundLabel, size: Rect, gap: number) {
  if (l.side !== 'auto') {
    return l.side;
  }
  const {plate, start} = geo;
  const f0 = plateFrameAt(plate, l.from + start);
  const f1 = plateFrameAt(plate, l.to + start);
  const mean = averagePoint(trackOf(plate, l.track), f0, f1);
  const at = toFrame(geo.drawn, mean.x, mean.y);
  return chooseSide(at, size, gap, geo.area);
}

/** Makes the function that places a label at a plate frame. */
function makePlacer(
  ctx: SceneContext,
  geo: PlateGeometry,
  l: BoundLabel,
  size: Rect,
): {at: (frame: number) => Placed; side: Side} {
  const gap = l.offset * ctx.u;
  const side = sideOf(geo, l, size, gap);
  const track = trackOf(geo.plate, l.track);
  const at = (f: number): Placed => {
    const point = toFrame(geo.drawn, track.x[f] ?? 0, track.y[f] ?? 0);
    const box = placeLabel(point, size, side, gap, geo.area);
    return {point, box, visible: (track.visible[f] ?? 0) > 0};
  };
  return {at, side};
}

/** Label speed between two plate frames, in short sides per second. */
function speedOf(a: Placed, b: Placed, step: number, short: number) {
  if (!a.visible || !b.visible) {
    return null;
  }
  const d = Math.hypot(b.box.x - a.box.x, b.box.y - a.box.y);
  return round3(d / step / short);
}

/** Records how fast the label moves while it is fully visible. */
function recordMotion(
  ctx: SceneContext,
  geo: PlateGeometry,
  l: BoundLabel,
  at: (frame: number) => Placed,
  texts: HTMLElement[],
) {
  const {plate, start} = geo;
  const step = 1 / plate.fps;
  const first = l.from + FADE_S;
  const count = Math.max(0, Math.floor((l.to - FADE_S - first) / step));
  const short = Math.min(ctx.W, ctx.H);
  const speed = Array.from({length: count}, (_, k) => {
    const t = first + k * step;
    const a = at(plateFrameAt(plate, t + start));
    const b = at(plateFrameAt(plate, t + step + start));
    return speedOf(a, b, step, short);
  });
  for (const el of texts) {
    ctx.motion(el, {at: first, step, speed});
  }
}

/** Alpha of a label: 1 while shown, fading in at `from` and out by `to`. */
function alphaOf(ctx: SceneContext, l: BoundLabel, t: number): number {
  const inn = ctx.ease.out(ctx.prog(t, l.from, FADE_S));
  return inn * (1 - ctx.prog(t, l.to - FADE_S, FADE_S));
}

/** The leader line and dot of one label, drawn in the shared overlay. */
function buildLeader(ctx: SceneContext, overlay: SVGElement) {
  const {h, u} = ctx;
  const line = h('line', {
    stroke: 'var(--ink)',
    'stroke-width': round3(LEADER_U * u),
  });
  const dot = h('circle', {fill: 'var(--ink)', r: round3(DOT_U * u)});
  const group = h('g', {}, line, dot);
  overlay.append(group);
  return {group, line, dot};
}

/** One built label: its box, optional leader and placement function. */
interface Rig {
  l: BoundLabel;
  box: HTMLElement;
  leader: ReturnType<typeof buildLeader> | null;
  at: (frame: number) => Placed;
  side: Side;
}

function buildOverlay(ctx: SceneContext): SVGElement {
  const overlay = ctx.h('svg', {
    style: {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      overflow: 'visible',
      filter: 'drop-shadow(0 0 calc(var(--u) * 0.3) var(--bg))',
    },
  });
  ctx.el.append(overlay);
  return overlay;
}

function buildRig(
  ctx: SceneContext,
  geo: PlateGeometry,
  l: BoundLabel,
  overlay: SVGElement,
): Rig {
  const {box, texts} = buildBox(ctx, l);
  ctx.el.append(box);
  const size = {x: 0, y: 0, w: box.offsetWidth, h: box.offsetHeight};
  const placer = makePlacer(ctx, geo, l, size);
  recordMotion(ctx, geo, l, placer.at, texts);
  const leader = l.leader ? buildLeader(ctx, overlay) : null;
  return {l, box, leader, ...placer};
}

/** Moves one label to its place at scene time `t` and plate frame `f`. */
function drawRig(ctx: SceneContext, rig: Rig, t: number, f: number): void {
  const {l, box, leader, at, side} = rig;
  const placed = at(f);
  const alpha = placed.visible ? alphaOf(ctx, l, t) : 0;
  const slide = (1 - ctx.ease.out(ctx.prog(t, l.from, FADE_S))) * SLIDE_U;
  const x = placed.box.x + SLIDE_AXIS[side].x * slide * ctx.u;
  const y = placed.box.y + SLIDE_AXIS[side].y * slide * ctx.u;
  box.style.transform = `translate(${round3(x)}px, ${round3(y)}px)`;
  box.style.opacity = String(round3(alpha));
  if (leader) {
    drawLeader(leader, placed, alpha);
  }
}

/**
 * Builds every label and the overlay for their leader lines.
 *
 * @param ctx Scene context. The labels are added to `ctx.el`.
 * @param geo Plate, drawn box and safe area.
 * @param labels Labels with resolved times.
 * @returns The per-frame function, or `null` when there are no labels.
 */
export function buildLabels(
  ctx: SceneContext,
  geo: PlateGeometry,
  labels: readonly BoundLabel[],
): ((t: number) => void) | null {
  if (!labels.length) {
    return null;
  }
  const overlay = buildOverlay(ctx);
  const rigs = labels.map(l => buildRig(ctx, geo, l, overlay));
  return t => {
    const f = plateFrameAt(geo.plate, t + geo.start);
    for (const rig of rigs) {
      drawRig(ctx, rig, t, f);
    }
  };
}

function drawLeader(
  leader: ReturnType<typeof buildLeader>,
  placed: Placed,
  alpha: number,
) {
  const end = leaderEnd(placed.box, placed.point);
  const {line, dot, group} = leader;
  group.setAttribute('opacity', String(round3(alpha)));
  dot.setAttribute('cx', String(round3(placed.point.x)));
  dot.setAttribute('cy', String(round3(placed.point.y)));
  line.setAttribute('visibility', end ? 'visible' : 'hidden');
  if (end) {
    line.setAttribute('x1', String(round3(placed.point.x)));
    line.setAttribute('y1', String(round3(placed.point.y)));
    line.setAttribute('x2', String(round3(end.x)));
    line.setAttribute('y2', String(round3(end.y)));
  }
}
