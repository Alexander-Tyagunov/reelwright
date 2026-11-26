/**
 * @fileoverview Geometry of a `plate` scene: where the plate is drawn in the
 * frame, and where a label goes against a tracked point. Pure: no DOM.
 * Every number is in frame pixels.
 */

import type {LabelSide} from './plate-spec.ts';

/** A box in frame pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A position in frame pixels. */
export interface Point {
  x: number;
  y: number;
}

/** A side that is not `auto`. */
export type Side = Exclude<LabelSide, 'auto'>;

/** The order in which `auto` prefers sides when two have equal room. */
const PREFERENCE: readonly Side[] = ['right', 'left', 'top', 'bottom'];

/**
 * Finds the box in which the plate image is drawn.
 *
 * @param frame Frame size.
 * @param plate Image size.
 * @param fit `cover` fills the frame and crops; `contain` shows all of the
 *   image and leaves bars.
 * @returns The drawn box, centred in the frame. It may reach past the frame
 *   for `cover`.
 */
export function fitRect(
  frame: {w: number; h: number},
  plate: {w: number; h: number},
  fit: 'cover' | 'contain',
): Rect {
  const sx = frame.w / plate.w;
  const sy = frame.h / plate.h;
  const k = fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const w = plate.w * k;
  const h = plate.h * k;
  return {x: (frame.w - w) / 2, y: (frame.h - h) / 2, w, h};
}

/**
 * Maps a point given as fractions of the plate to frame pixels.
 *
 * @param drawn The box from {@link fitRect}.
 * @param x 0 at the left edge to 1 at the right edge.
 * @param y 0 at the top edge to 1 at the bottom edge.
 */
export function toFrame(drawn: Rect, x: number, y: number): Point {
  return {x: drawn.x + x * drawn.w, y: drawn.y + y * drawn.h};
}

function roomOn(side: Side, p: Point, size: Rect, gap: number, area: Rect) {
  const {w, h} = size;
  const room: Record<Side, number> = {
    right: area.x + area.w - p.x - gap - w,
    left: p.x - area.x - gap - w,
    top: p.y - area.y - gap - h,
    bottom: area.y + area.h - p.y - gap - h,
  };
  return room[side];
}

/**
 * Picks the side with the most room inside the area.
 *
 * @param point The tracked point.
 * @param size Label size; only `w` and `h` are read.
 * @param gap Distance between the point and the label, in pixels.
 * @param area The area the label must stay in: the safe area.
 * @returns A side. Ties go to right, left, top, then bottom.
 */
export function chooseSide(
  point: Point,
  size: {w: number; h: number},
  gap: number,
  area: Rect,
): Side {
  const box = {x: 0, y: 0, ...size};
  let best: Side = PREFERENCE[0] ?? 'right';
  for (const side of PREFERENCE) {
    if (
      roomOn(side, point, box, gap, area) > roomOn(best, point, box, gap, area)
    ) {
      best = side;
    }
  }
  return best;
}

function unclamped(side: Side, p: Point, size: Rect, gap: number): Point {
  const {w, h} = size;
  switch (side) {
    case 'right':
      return {x: p.x + gap, y: p.y - h / 2};
    case 'left':
      return {x: p.x - gap - w, y: p.y - h / 2};
    case 'top':
      return {x: p.x - w / 2, y: p.y - gap - h};
    case 'bottom':
      return {x: p.x - w / 2, y: p.y + gap};
  }
}

/**
 * Places a label box on one side of a point, then moves it inside the area.
 *
 * @param point The tracked point.
 * @param size Label size in pixels.
 * @param side Which side of the point the box sits on.
 * @param gap Distance between the point and the nearest box edge.
 * @param area The area the whole box must stay in. A box larger than the
 *   area sticks to the area's top left corner.
 */
export function placeLabel(
  point: Point,
  size: {w: number; h: number},
  side: Side,
  gap: number,
  area: Rect,
): Rect {
  const at = unclamped(side, point, {x: 0, y: 0, ...size}, gap);
  const x = Math.max(area.x, Math.min(at.x, area.x + area.w - size.w));
  const y = Math.max(area.y, Math.min(at.y, area.y + area.h - size.h));
  return {x, y, w: size.w, h: size.h};
}

/**
 * Finds the end of a leader line on the box: the box's nearest point.
 *
 * @returns The point on the box edge, or `null` when `point` is inside it.
 */
export function leaderEnd(box: Rect, point: Point): Point | null {
  const x = Math.max(box.x, Math.min(point.x, box.x + box.w));
  const y = Math.max(box.y, Math.min(point.y, box.y + box.h));
  return x === point.x && y === point.y ? null : {x, y};
}
