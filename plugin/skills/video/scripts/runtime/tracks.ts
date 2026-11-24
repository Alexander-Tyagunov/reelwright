/**
 * @fileoverview Tracks: declared motion of one element. A track is a plain
 * description; its value at time `t` comes from a formula, so any frame can
 * be drawn alone. Times are in scene-local seconds, offsets in `u`.
 */

import type {EaseFn} from './easing.ts';
import {ease as namedEases} from './easing.ts';
import {clamp, lerp, prog, round3} from './math.ts';
import type {SpringSpec} from './spring.ts';
import {spring, springSettle} from './spring.ts';
import type {StyledElement, TrackProps, TrackSpec} from './types.ts';

/** A track with every default filled in. */
export interface Track {
  /** Start, in scene-local seconds. */
  at: number;
  /** Length in seconds. Unused when `spring` is set. */
  dur: number;
  from: TrackProps;
  to: TrackProps;
  ease: EaseFn;
  spring: SpringSpec | null;
  /** Scene-local second at which the motion is done. */
  end: number;
}

/** All tracks of a scene, by element. Each list is sorted by start time. */
export type TrackTable = Map<StyledElement, Track[]>;

/** A recorded settle time for an element that a frame function drives. */
export interface SettleMark {
  el: Node;
  /** Scene-local seconds. */
  at: number;
}

/** Resolved values of every animatable property. */
export type TrackState = Required<TrackProps>;

const IDENTITY: TrackState = {opacity: 1, x: 0, y: 0, scale: 1, rotate: 0};
const KEYS = ['opacity', 'x', 'y', 'scale', 'rotate'] as const;
const DEFAULT_DURATION = 0.6;

function pickEase(spec: TrackSpec): EaseFn {
  if (typeof spec.ease === 'function') {
    return spec.ease;
  }
  const name = spec.ease || 'out';
  const found = Object.hasOwn(namedEases, name) ? namedEases[name] : undefined;
  if (!found) {
    throw new Error(`unknown ease "${name}"`);
  }
  return found;
}

/**
 * Turns a track spec into a track with defaults and an end time.
 * @param spec Options from a scene author.
 * @throws Error when `spec.ease` names an unknown curve.
 */
export function createTrack(spec: TrackSpec): Track {
  const at = spec.at || 0;
  const dur = spec.dur ?? DEFAULT_DURATION;
  const sp = spec.spring ?? null;
  return {
    at,
    dur,
    from: spec.from ?? {},
    to: spec.to ?? {},
    ease: pickEase(spec),
    spring: sp,
    end: at + (sp ? springSettle(sp) : dur),
  };
}

/**
 * Adds a track to the table and keeps the element's list sorted by start.
 * @param table The scene's track table.
 * @param el The element the track moves.
 * @param track The track to add.
 */
export function addTrack(table: TrackTable, el: StyledElement, track: Track) {
  const list = table.get(el) ?? [];
  list.push(track);
  list.sort((a, b) => a.at - b.at);
  table.set(el, list);
}

/**
 * Evaluates all tracks of one element at a time.
 * @param list Tracks sorted by start time.
 * @param t Scene-local time in seconds.
 */
export function evaluateTracks(list: readonly Track[], t: number): TrackState {
  const st: TrackState = {...IDENTITY, ...list[0]?.from};
  for (const tr of list) {
    if (t < tr.at) {
      break;
    }
    const p = tr.spring
      ? spring(t - tr.at, tr.spring)
      : tr.ease(prog(t, tr.at, tr.dur));
    for (const k of KEYS) {
      if (k in tr.from || k in tr.to) {
        st[k] = lerp(tr.from[k] ?? st[k], tr.to[k] ?? IDENTITY[k], p);
      }
    }
  }
  return st;
}

/**
 * Writes the state of an element at time `t` into its inline style.
 * @param el The element.
 * @param list Its tracks, sorted by start time.
 * @param t Scene-local time in seconds.
 * @param u One unit in pixels.
 */
export function applyTracks(
  el: StyledElement,
  list: readonly Track[],
  t: number,
  u: number,
): void {
  const st = evaluateTracks(list, t);
  el.style.opacity = String(round3(clamp(st.opacity)));
  el.style.transform =
    `translate(${round3(st.x * u)}px, ${round3(st.y * u)}px) ` +
    `scale(${round3(st.scale)}) rotate(${round3(st.rotate)}deg)`;
}

/**
 * Finds when an element is fully revealed: the latest end of any track or
 * settle mark on the element, an ancestor or a descendant.
 * @param el The element, usually a registered text.
 * @param table The scene's track table.
 * @param marks Settle marks recorded with `ctx.settle`.
 * @returns Scene-local seconds. 0 when nothing animates the element.
 */
export function elementSettle(
  el: Node,
  table: TrackTable,
  marks: readonly SettleMark[],
): number {
  const related = (other: Node) =>
    other === el || other.contains(el) || el.contains(other);
  let end = 0;
  for (const [other, list] of table) {
    if (related(other)) {
      for (const tr of list) {
        end = Math.max(end, tr.end);
      }
    }
  }
  for (const mark of marks) {
    if (related(mark.el)) {
      end = Math.max(end, mark.at);
    }
  }
  return end;
}
