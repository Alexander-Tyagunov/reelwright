/**
 * @fileoverview A small synthetic plate for the tests: 45 frames at 15 fps,
 * 640x360, drawn by ffmpeg. The background shifts a little on every frame so
 * each frame differs, and a red box moves slowly across it. The plate's one
 * point follows the box. Also helpers that read grey pixels from an image or
 * from one frame of a video.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

/** Frames in the synthetic plate. */
export const PLATE_FRAMES = 45;
/** Frames per second of the synthetic plate. */
export const PLATE_FPS = 15;
/** Width of a plate frame in pixels. */
export const PLATE_W = 640;
/** Height of a plate frame in pixels. */
export const PLATE_H = 360;

const BOX = 60;
const BOX_Y = 150;

/** Centre of the box in frame `n`, in plate pixels. */
function boxCentre(n: number, perFrame: number): {x: number; y: number} {
  return {x: 100 + perFrame * n + BOX / 2, y: BOX_Y + BOX / 2};
}

/** Where a plate was written. */
export interface PlateFiles {
  /** Folder of the plate, absolute. */
  dir: string;
  /** Path of `tracks.json` relative to the project folder. */
  tracks: string;
}

/** Builds the contents of a `tracks.json` for the box. */
export function tracksJson(perFrame: number, events = true): object {
  const frames = Array.from({length: PLATE_FRAMES}, (_, n) => n);
  const at = frames.map(n => boxCentre(n, perFrame));
  return {
    version: 1,
    fps: PLATE_FPS,
    frames: PLATE_FRAMES,
    width: PLATE_W,
    height: PLATE_H,
    // biome-ignore lint/style/useNamingConvention: the file format's own key
    frame_pattern: 'frames/%04d.jpg',
    first: 1,
    points: {
      box: {
        x: at.map(p => Number((p.x / PLATE_W).toFixed(5))),
        y: at.map(p => Number((p.y / PLATE_H).toFixed(5))),
        visible: frames.map(() => 1),
        depth: frames.map(() => 8),
      },
    },
    events: events ? [{name: 'split', frame: 20}] : [],
  };
}

/**
 * Writes the frames and a slow `tracks.json` below a project folder.
 *
 * @param project Absolute project folder.
 * @param name Folder name below `plates/`.
 * @param bright Draws a near-white background instead of the dark one.
 * @throws Error with ffmpeg's output when ffmpeg fails.
 */
export function writePlate(
  project: string,
  name = 'shot01',
  bright = false,
): PlateFiles {
  const dir = join(project, 'plates', name);
  mkdirSync(join(dir, 'frames'), {recursive: true});
  const size = `${PLATE_W}x${PLATE_H}:r=${PLATE_FPS}`;
  const colour = bright
    ? "r='215+X*0.02':g='220':b='225'"
    : "r='20+X*0.1':g='45+Y*0.1+25*sin((X+N*12)/30)':b=70";
  const graph =
    `[0:v]format=gbrp,geq=${colour},` +
    'format=yuv420p[bg];' +
    `[bg][1:v]overlay=x='100+n':y=${BOX_Y}:eval=frame`;
  const r = spawnSync(
    'ffmpeg',
    [
      ...['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${size}`],
      ...['-f', 'lavfi', '-i', `color=c=red:s=${BOX}x${BOX}:r=${PLATE_FPS}`],
      ...['-filter_complex', graph],
      ...['-frames:v', String(PLATE_FRAMES), '-start_number', '1'],
      ...['-q:v', '3', join(dir, 'frames', '%04d.jpg')],
    ],
    {encoding: 'utf8'},
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg could not draw the test plate:\n${r.stderr}`);
  }
  const tracks = join('plates', name, 'tracks.json');
  writeFileSync(join(project, tracks), JSON.stringify(tracksJson(1), null, 2));
  return {dir, tracks};
}

/**
 * Reads one picture or one video frame as 8-bit grey pixels.
 *
 * @param file Image or video path.
 * @param frame Zero-based video frame to take, or omit for an image.
 * @param width Width the picture is scaled to, in pixels.
 * @param height Height the picture is scaled to, in pixels.
 */
export function greyPixels(
  file: string,
  frame: number | null,
  width = 160,
  height = 90,
): Uint8Array {
  const pick = frame === null ? '' : `select='eq(n,${frame})',`;
  const r = spawnSync(
    'ffmpeg',
    [
      ...['-v', 'error', '-i', file],
      ...['-vf', `${pick}scale=${width}:${height}:out_range=pc,format=gray`],
      ...['-frames:v', '1', '-f', 'rawvideo', '-'],
    ],
    {maxBuffer: 1 << 24},
  );
  if (r.status !== 0 || r.stdout.length !== width * height) {
    throw new Error(`could not read pixels of ${file}: ${r.stderr}`);
  }
  return new Uint8Array(r.stdout);
}

/** Mean absolute difference, in grey levels, of two equally sized pictures. */
export function meanDifference(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (const [i, v] of a.entries()) {
    sum += Math.abs(v - (b[i] ?? 0));
  }
  return sum / a.length;
}

/** Standard deviation of the grey levels of a picture. */
export function spread(pixels: Uint8Array): number {
  const mean = pixels.reduce((s, v) => s + v, 0) / pixels.length;
  const variance =
    pixels.reduce((s, v) => s + (v - mean) ** 2, 0) / pixels.length;
  return Math.sqrt(variance);
}
