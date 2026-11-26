/**
 * @fileoverview Reads the fields of a `plate` scene and binds them to a
 * checked plate: event times become seconds and every label's track must
 * exist. Pure: no DOM, so the unit tests import it. Times are scene-local
 * seconds, sizes are in `u`.
 */

import type {SceneSpec} from '../../../shared/contract.ts';
import type {Plate} from '../../../shared/plate.ts';
import type {SceneChecks} from './validate.ts';
import {sceneChecks} from './validate.ts';

/** Where a label sits against its point. */
export type LabelSide = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/** A time: seconds, or an event of the plate plus an offset in seconds. */
export type TimeRef = number | {event: string; plus?: number};

/** One label as written in the spec, with defaults filled in. */
export interface LabelSpec {
  track: string;
  text: string;
  sub: string;
  from: TimeRef | undefined;
  to: TimeRef | undefined;
  side: LabelSide;
  /** Distance between the point and the label box, in `u`. */
  offset: number;
  leader: boolean;
  variant: 'tag' | 'plain';
}

/** One free text overlay as written in the spec. */
export interface TextSpec {
  text: string;
  /** A type class such as `rw-kicker`. */
  cls: string;
  /** Position from the left edge in `u`, or `center`. */
  x: number | 'center';
  /** Position from the top edge in `u`, or `center`. */
  y: number | 'center';
  from: TimeRef | undefined;
  to: TimeRef | undefined;
  align: 'left' | 'center' | 'right';
}

/** The fields of a `plate` scene, checked. */
export interface PlateOptions {
  /** Path of `tracks.json`, relative to the film folder. */
  plate: string;
  /** Seconds into the plate at which the scene starts. */
  start: number;
  fit: 'cover' | 'contain';
  labels: LabelSpec[];
  texts: TextSpec[];
}

/** A label with its times resolved to scene-local seconds. */
export interface BoundLabel extends LabelSpec {
  from: number;
  to: number;
}

/** A text overlay with its times resolved to scene-local seconds. */
export interface BoundText extends Omit<TextSpec, 'from' | 'to'> {
  from: number;
  /** `null` keeps the text until the scene ends. */
  to: number | null;
}

/** Every field a `plate` scene accepts. */
export const PLATE_FIELDS = [
  'plate',
  'start',
  'fit',
  'labels',
  'texts',
  'cues',
] as const;

type Raw = Record<string, unknown>;

function record(path: string, value: unknown): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object; got ${JSON.stringify(value)}`);
  }
  return value as Raw;
}

function oneOf<T extends string>(
  path: string,
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) {
    return fallback;
  }
  if (!allowed.includes(value as T)) {
    const got = JSON.stringify(value);
    throw new Error(`${path} must be one of ${allowed.join(', ')}; got ${got}`);
  }
  return value as T;
}

function timeRef(
  check: SceneChecks,
  path: string,
  value: unknown,
): TimeRef | undefined {
  if (value === undefined || typeof value === 'number') {
    return check.optionalNumber(path, value);
  }
  const ref = record(path, value);
  const event = check.text(`${path}.event`, ref.event);
  return {event, plus: check.optionalNumber(`${path}.plus`, ref.plus)};
}

function parseLabel(check: SceneChecks, raw: unknown, i: number): LabelSpec {
  const p = `labels[${i}]`;
  const l = record(p, raw);
  const offset = check.optionalNumber(`${p}.offset`, l.offset) ?? 5;
  if (offset < 0 || offset > 60) {
    throw new Error(`${p}.offset must be from 0 to 60 u; got ${offset}`);
  }
  return {
    track: check.text(`${p}.track`, l.track),
    text: check.text(`${p}.text`, l.text),
    sub: typeof l.sub === 'string' ? l.sub : '',
    from: timeRef(check, `${p}.from`, l.from),
    to: timeRef(check, `${p}.to`, l.to),
    side: oneOf(`${p}.side`, l.side, SIDES, 'auto'),
    offset,
    leader: l.leader !== false,
    variant: oneOf(`${p}.variant`, l.variant, ['tag', 'plain'], 'tag'),
  };
}

const SIDES = ['top', 'bottom', 'left', 'right', 'auto'] as const;

function position(check: SceneChecks, path: string, v: unknown) {
  return v === 'center' ? v : check.number(path, v);
}

function parseText(check: SceneChecks, raw: unknown, i: number): TextSpec {
  const p = `texts[${i}]`;
  const t = record(p, raw);
  return {
    text: check.text(`${p}.text`, t.text),
    cls: typeof t.class === 'string' ? t.class : 'rw-body',
    x: position(check, `${p}.x`, t.x),
    y: position(check, `${p}.y`, t.y),
    from: timeRef(check, `${p}.from`, t.from),
    to: timeRef(check, `${p}.to`, t.to),
    align: oneOf(`${p}.align`, t.align, ['left', 'center', 'right'], 'left'),
  };
}

/**
 * Reads and checks the fields of a `plate` scene. Times that name an event
 * stay unresolved until {@link bindPlate}.
 *
 * @param scene The scene entry from the spec.
 * @throws Error that names the field, what was expected and what was found.
 */
export function parsePlateOptions(scene: SceneSpec): PlateOptions {
  const check = sceneChecks(scene, PLATE_FIELDS);
  const list = (name: string, value: unknown): unknown[] =>
    value === undefined ? [] : check.list(name, value, 0, 40);
  return {
    plate: check.text('plate', scene.plate),
    start: check.optionalNumber('start', scene.start) ?? 0,
    fit: oneOf('fit', scene.fit, ['cover', 'contain'], 'cover'),
    labels: list('labels', scene.labels).map((l, i) => parseLabel(check, l, i)),
    texts: list('texts', scene.texts).map((t, i) => parseText(check, t, i)),
  };
}

/**
 * Turns a time into scene-local seconds.
 *
 * @param ref Seconds, or an event name with an optional offset.
 * @param start Seconds into the plate at which the scene starts.
 * @param path Field name for messages.
 * @throws Error that lists the plate's events when the name is unknown.
 */
export function resolveTime(
  ref: TimeRef,
  plate: Plate,
  start: number,
  path: string,
): number {
  if (typeof ref === 'number') {
    return ref;
  }
  const found = plate.events.find(e => e.name === ref.event);
  if (!found) {
    const names = plate.events.map(e => e.name).join(', ') || 'none';
    throw new Error(
      `${path}: the plate has no event "${ref.event}". Events: ${names}`,
    );
  }
  return found.frame / plate.fps - start + (ref.plus ?? 0);
}

function span(
  opts: {from: TimeRef | undefined; to: TimeRef | undefined},
  plate: Plate,
  start: number,
  path: string,
  duration: number,
): {from: number; to: number | null} {
  const from = resolveTime(opts.from ?? 0, plate, start, `${path}.from`);
  const to =
    opts.to === undefined
      ? null
      : resolveTime(opts.to, plate, start, `${path}.to`);
  if (to !== null && !(to > from)) {
    throw new Error(
      `${path}.to (${to.toFixed(2)} s) must be after from ` +
        `(${from.toFixed(2)} s) within the ${duration} s scene`,
    );
  }
  return {from, to};
}

/**
 * Binds the scene's fields to its plate: resolves events, fills the end of
 * each label to the scene length, and requires every label's track to exist.
 *
 * @param options The scene fields from {@link parsePlateOptions}.
 * @param duration Scene length in seconds.
 * @throws Error that lists the track names for an unknown track, or the
 *   events for an unknown event.
 */
export function bindPlate(
  options: PlateOptions,
  plate: Plate,
  duration: number,
): {labels: BoundLabel[]; texts: BoundText[]} {
  const {start} = options;
  if (start < 0 || start >= plate.frames / plate.fps) {
    throw new Error(
      `start must be from 0 to ${(plate.frames / plate.fps).toFixed(2)} s, ` +
        `the length of the plate; got ${start}`,
    );
  }
  const names = Object.keys(plate.points);
  const labels = options.labels.map((l, i) => {
    const path = `labels[${i}]`;
    if (!Object.hasOwn(plate.points, l.track)) {
      throw new Error(
        `${path}.track "${l.track}" is not in tracks.json. ` +
          `Tracks: ${names.join(', ') || 'none'}`,
      );
    }
    const w = span(l, plate, start, path, duration);
    return {...l, from: w.from, to: w.to ?? duration};
  });
  const texts = options.texts.map((t, i) => ({
    ...t,
    ...span(t, plate, start, `texts[${i}]`, duration),
  }));
  return {labels, texts};
}
