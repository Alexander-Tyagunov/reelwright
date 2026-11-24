/**
 * @fileoverview Plans a render: which frames belong to which scene segment,
 * and the cache key of each segment.
 */
import {join} from 'node:path';
import type {OpenFilm} from '../../browser/film.ts';
import {runtimeHash, sha1} from '../../core/hash.ts';
import {projectStamp} from '../../core/stamp.ts';

/** Settings that decide how every segment is drawn and encoded. */
export interface RenderSettings {
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Frames per second of the output. */
  fps: number;
  /** x264 constant rate factor. */
  crf: number;
  /** Frames are PNG instead of JPEG. */
  png: boolean;
  /** Half-size on each side, lower-quality preview. */
  draft: boolean;
}

/** One scene's share of the output: a run of frames in one MP4 file. */
export interface Segment {
  /** Scene index, from 0. */
  index: number;
  type: string;
  /** First frame, inclusive. */
  from: number;
  /** End frame, exclusive. */
  to: number;
  /** Cache file. The name is the segment's key. */
  file: string;
}

/** Fraction of each side that draft frames keep. */
const DRAFT_SIDE_FRACTION = 0.5;

/**
 * Size of the encoded frames in pixels. Draft frames have half the width and
 * half the height, rounded to an even number: 1920x1080 gives 960x540.
 */
export function outputSize(settings: RenderSettings): {
  width: number;
  height: number;
} {
  if (!settings.draft) {
    return {width: settings.width, height: settings.height};
  }
  const shrink = (n: number): number =>
    Math.round((n * DRAFT_SIDE_FRACTION) / 2) * 2;
  return {width: shrink(settings.width), height: shrink(settings.height)};
}

/**
 * Splits the film into segments. A segment starts at the first frame at or
 * after its scene starts, so no frame is drawn twice. The key covers
 * everything a segment's pixels depend on, so an unchanged scene is reused
 * from an earlier render. A scene's neighbours matter only through the
 * previous scene and the global overlays, and both are in the key.
 *
 * @param segDir Folder that holds the segment files.
 * @param frames Total frame count at the output frame rate.
 * @returns Segments in film order. Scenes with no frames are left out.
 */
export function planSegments(
  film: OpenFilm,
  settings: RenderSettings,
  segDir: string,
  frames: number,
): Segment[] {
  const {info, spec} = film;
  const rt = runtimeHash();
  const stamp = projectStamp(spec.dir, spec.film);
  const {fps} = settings;
  const starts = info.scenes.map((s, i) =>
    i === 0 ? 0 : Math.ceil(s.start * fps - 1e-9),
  );
  const segments = info.scenes.map((s, i): Segment => {
    const from = starts[i] ?? 0;
    const to = i + 1 < starts.length ? (starts[i + 1] ?? frames) : frames;
    const key = sha1({
      rt,
      stamp,
      index: i,
      meta: spec.film.meta,
      brand: spec.film.brand,
      prev: i ? spec.film.scenes[i - 1] : null,
      scene: spec.film.scenes[i],
      w: settings.width,
      h: settings.height,
      fps,
      crf: settings.crf,
      png: settings.png,
      draft: settings.draft,
      phase: Number(((s.start * fps) % 1).toFixed(6)),
      n: to - from,
      global: info.globalOverlays
        ? {start: s.start, total: info.duration, captions: spec.film.captions}
        : null,
    });
    return {index: i, type: s.type, from, to, file: join(segDir, `${key}.mp4`)};
  });
  return segments.filter(s => s.to > s.from);
}
