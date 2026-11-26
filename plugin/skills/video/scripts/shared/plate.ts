/**
 * @fileoverview The plate data contract. A plate is a folder with a
 * `tracks.json` and a numbered image sequence rendered elsewhere, for example
 * in Blender. This module reads and checks `tracks.json` and maps times to
 * frame files. It has no DOM and no Node APIs, so the browser runtime, the
 * `plate` command and the tests all use it.
 */

/** One tracked point: a value per plate frame for every array. */
export interface PlatePoint {
  /** Horizontal position, 0 at the left edge to 1 at the right edge. */
  x: number[];
  /** Vertical position, 0 at the top edge to 1 at the bottom edge. */
  y: number[];
  /** 1 while the point can be seen, 0 when behind the camera or hidden. */
  visible: number[];
  /** Distance from the camera in metres. Present only when exported. */
  depth?: number[];
}

/** A named frame of the plate that a film can refer to. */
export interface PlateEvent {
  name: string;
  /** Zero-based frame within the plate. */
  frame: number;
}

/** A checked `tracks.json`. */
export interface Plate {
  /** Frames per second of the image sequence. */
  fps: number;
  /** Number of frames. */
  frames: number;
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Frame file name with one index, such as `frames/%04d.jpg`. */
  framePattern: string;
  /** Number that the first frame file carries in its name. */
  first: number;
  points: Record<string, PlatePoint>;
  events: PlateEvent[];
}

/** The highest `version` of `tracks.json` this engine reads. */
export const PLATE_VERSION = 1;

const INDEX_FIELD = /%0?(\d*)d/g;
const POINT_ARRAYS = ['x', 'y', 'visible'] as const;

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shown(value: unknown): string {
  const text = JSON.stringify(value) ?? 'undefined';
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

function whole(raw: Raw, key: string, min: number, max: number): number {
  const v = raw[key];
  if (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max) {
    return v;
  }
  throw new Error(
    `${key} must be a whole number from ${min} to ${max}; got ${shown(v)}. ` +
      'Export the tracks again from the 3D scene.',
  );
}

function numbers(path: string, value: unknown, frames: number): number[] {
  if (!Array.isArray(value) || value.length !== frames) {
    const n = Array.isArray(value) ? `${value.length} values` : 'no list';
    throw new Error(
      `${path} has ${n}, but frames is ${frames}. Export the tracks again ` +
        'so every array has one value per frame.',
    );
  }
  const bad = value.findIndex(
    v => typeof v !== 'number' || !Number.isFinite(v),
  );
  if (bad >= 0) {
    throw new Error(
      `${path}[${bad}] must be a number; got ${shown(value[bad])}.`,
    );
  }
  return value as number[];
}

function parsePoint(name: string, raw: unknown, frames: number): PlatePoint {
  if (!isRecord(raw)) {
    throw new Error(`points.${name} must be an object with x, y and visible`);
  }
  const point: PlatePoint = {x: [], y: [], visible: []};
  for (const key of POINT_ARRAYS) {
    point[key] = numbers(`points.${name}.${key}`, raw[key], frames);
  }
  if (raw.depth !== undefined) {
    point.depth = numbers(`points.${name}.depth`, raw.depth, frames);
  }
  return point;
}

function parseEvents(raw: unknown, frames: number): PlateEvent[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error('events must be a list of {name, frame}');
  }
  return raw.map((e: unknown, i) => {
    const ev = isRecord(e) ? e : {};
    const {name, frame} = ev;
    if (
      typeof name === 'string' &&
      name &&
      typeof frame === 'number' &&
      Number.isInteger(frame) &&
      frame >= 0 &&
      frame < frames
    ) {
      return {name, frame};
    }
    throw new Error(
      `events[${i}] must be {name, frame} with a frame from 0 to ` +
        `${frames - 1}; got ${shown(e)}`,
    );
  });
}

function parsePattern(raw: Raw): string {
  const pattern = raw.frame_pattern;
  const fields = typeof pattern === 'string' ? pattern.match(INDEX_FIELD) : [];
  if (typeof pattern !== 'string' || fields?.length !== 1) {
    throw new Error(
      'frame_pattern must hold one printf-style index such as ' +
        `"frames/%04d.jpg"; got ${shown(pattern)}`,
    );
  }
  return pattern;
}

/**
 * Checks a parsed `tracks.json` and returns it with every default filled in.
 *
 * @param json The parsed file.
 * @throws Error that says what is wrong and what to do about it: an
 *   unsupported version, a wrong array length, a bad pattern or event.
 */
export function parsePlate(json: unknown): Plate {
  if (!isRecord(json)) {
    throw new Error('tracks.json must be a JSON object');
  }
  if (json.version !== PLATE_VERSION) {
    throw new Error(
      `tracks.json version ${shown(json.version)} is not supported; this ` +
        `Reelwright reads version ${PLATE_VERSION}. Export the tracks again ` +
        'with a matching exporter.',
    );
  }
  const frames = whole(json, 'frames', 1, 1_000_000);
  const first = json.first === undefined ? 1 : whole(json, 'first', 0, 1e9);
  const points: Record<string, PlatePoint> = {};
  const rawPoints = isRecord(json.points) ? json.points : {};
  for (const [name, raw] of Object.entries(rawPoints)) {
    points[name] = parsePoint(name, raw, frames);
  }
  const fps = json.fps;
  if (typeof fps !== 'number' || !(fps > 0 && fps <= 1000)) {
    throw new Error(`fps must be a number from 0 to 1000; got ${shown(fps)}`);
  }
  return {
    fps,
    frames,
    first,
    width: whole(json, 'width', 1, 32768),
    height: whole(json, 'height', 1, 32768),
    framePattern: parsePattern(json),
    points,
    events: parseEvents(json.events, frames),
  };
}

/**
 * Maps a time inside the plate to the frame that is shown.
 *
 * @param seconds Seconds from the first frame of the plate.
 * @returns A zero-based frame, held at the first or last frame when the time
 *   lies outside the plate.
 */
export function plateFrameAt(
  plate: Pick<Plate, 'fps' | 'frames'>,
  seconds: number,
): number {
  const index = Math.floor(seconds * plate.fps + 1e-6);
  return Math.min(Math.max(index, 0), plate.frames - 1);
}

/**
 * Names the file of one frame.
 *
 * @param tracksPath Path of `tracks.json`, with `/` as separator.
 * @param index Zero-based frame within the plate.
 * @returns A path in the same style as `tracksPath`.
 */
export function plateFramePath(
  plate: Pick<Plate, 'framePattern' | 'first'>,
  tracksPath: string,
  index: number,
): string {
  const folder = tracksPath.slice(0, tracksPath.lastIndexOf('/') + 1);
  const name = plate.framePattern.replace(INDEX_FIELD, (_m, width: string) =>
    String(plate.first + index).padStart(Number(width) || 0, '0'),
  );
  return folder + name;
}

/**
 * Finds the share of frames in which a point can be seen.
 *
 * @returns A number from 0 to 1.
 */
export function visibleShare(point: PlatePoint): number {
  const seen = point.visible.filter(v => v > 0).length;
  return point.visible.length ? seen / point.visible.length : 0;
}
