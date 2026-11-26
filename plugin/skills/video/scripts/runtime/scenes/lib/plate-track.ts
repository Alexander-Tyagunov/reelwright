/**
 * @fileoverview Where a label box goes at each plate frame. The box follows
 * a smoothed copy of the tracked point, or only its x, or nothing, while the
 * dot and the end of the leader line stay on the exact point. The position
 * is a pure function of the plate frame. Sizes are frame pixels.
 */

import type {Plate, PlatePoint} from '../../../shared/plate.ts';
import {plateFrameAt} from '../../../shared/plate.ts';
import type {Point, Rect, Side} from './plate-place.ts';
import {chooseSide, placeLabel, toFrame} from './plate-place.ts';
import {smoothTrack, verticalExtent} from './plate-smooth.ts';
import type {BoundLabel} from './plate-spec.ts';

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
export interface Placed {
  /** The exact tracked point, in frame pixels. */
  point: Point;
  /** The label box after smoothing, following and clamping. */
  box: Rect;
  visible: boolean;
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

/** The plate frames in which the label is shown. */
function frames(geo: PlateGeometry, l: BoundLabel): [number, number] {
  const {plate, start} = geo;
  return [
    plateFrameAt(plate, l.from + start),
    plateFrameAt(plate, l.to + start),
  ];
}

/** Chooses the side once from the point's average place on screen. */
function sideOf(geo: PlateGeometry, l: BoundLabel, size: Rect, gap: number) {
  if (l.side !== 'auto') {
    return l.side;
  }
  const [f0, f1] = frames(geo, l);
  const mean = averagePoint(trackOf(geo.plate, l.track), f0, f1);
  const at = toFrame(geo.drawn, mean.x, mean.y);
  return chooseSide(at, size, gap, geo.area);
}

/** The one top edge of a label that never meets a hopping point. */
function fixedTop(
  geo: PlateGeometry,
  l: BoundLabel,
  size: Rect,
  side: Side,
  gap: number,
): number {
  const [f0, f1] = frames(geo, l);
  const ext = verticalExtent(trackOf(geo.plate, l.track), f0, f1);
  const top = toFrame(geo.drawn, 0, ext.top).y;
  const bottom = toFrame(geo.drawn, 0, ext.bottom).y;
  const y = {
    top: top - gap - size.h,
    bottom: bottom + gap,
    left: top - size.h / 2,
    right: top - size.h / 2,
  }[side];
  const {area} = geo;
  return Math.max(area.y, Math.min(y, area.y + area.h - size.h));
}

/** The box of a label that keeps its place: where the point is at `from`. */
function stayingBox(
  geo: PlateGeometry,
  l: BoundLabel,
  size: Rect,
  side: Side,
  gap: number,
): Rect {
  const [f0, f1] = frames(geo, l);
  const track = trackOf(geo.plate, l.track);
  let f = f0;
  while (f < f1 && !((track.visible[f] ?? 0) > 0)) {
    f++;
  }
  const point = toFrame(geo.drawn, track.x[f] ?? 0, track.y[f] ?? 0);
  return placeLabel(point, size, side, gap, geo.area);
}

/**
 * Makes the function that places a label at a plate frame.
 *
 * @param geo Plate, drawn box and safe area.
 * @param l The label, with `smooth` and `follow` filled in.
 * @param size Label box size in pixels.
 * @param gap Distance between the point and the box, in pixels.
 * @returns `at(frame)` for the exact point and the box, and the side used.
 *   The smoothed track is computed here once.
 */
export function makePlacer(
  geo: PlateGeometry,
  l: BoundLabel,
  size: Rect,
  gap: number,
): {at: (frame: number) => Placed; side: Side} {
  const side = sideOf(geo, l, size, gap);
  const track = trackOf(geo.plate, l.track);
  const smooth = smoothTrack(track, geo.plate.fps, l.smooth);
  const still =
    l.follow === 'none' ? stayingBox(geo, l, size, side, gap) : null;
  const top = l.follow === 'x' ? fixedTop(geo, l, size, side, gap) : null;
  const at = (f: number): Placed => {
    const point = toFrame(geo.drawn, track.x[f] ?? 0, track.y[f] ?? 0);
    const visible = (track.visible[f] ?? 0) > 0;
    if (still) {
      return {point, box: still, visible};
    }
    const glide = toFrame(geo.drawn, smooth.x[f] ?? 0, smooth.y[f] ?? 0);
    const box = placeLabel(glide, size, side, gap, geo.area);
    return {point, box: top === null ? box : {...box, y: top}, visible};
  };
  return {at, side};
}
