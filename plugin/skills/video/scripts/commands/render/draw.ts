/**
 * @fileoverview Draws and encodes segments, one per page, in parallel.
 */
import type {FilmPage} from '../../browser/film.ts';
import {drawAt} from '../../browser/film.ts';
import type {Encoder} from '../../video/encoder.ts';
import {openEncoder} from '../../video/encoder.ts';
import type {RenderSettings, Segment} from './plan.ts';

/** Encoder choices that follow from the render settings. */
export interface DrawOptions {
  /** x264 preset name. */
  preset: string;
  /** Output size as `width:height`, or null for the page size. */
  scale: string | null;
}

async function drawSegment(
  page: FilmPage,
  seg: Segment,
  settings: RenderSettings,
  options: DrawOptions,
  active: Set<Encoder>,
): Promise<void> {
  const {fps, crf, png} = settings;
  const encoder = openEncoder({
    out: seg.file,
    fps,
    crf,
    png,
    preset: options.preset,
    scale: options.scale,
  });
  active.add(encoder);
  const format = png ? {format: 'png' as const} : {quality: 92};
  // Draw frames 0..N-1 of the segment, never frame N.
  for (let k = seg.from; k < seg.to; k++) {
    await drawAt(page, k / fps);
    await encoder.write(await page.shot(format));
  }
  await encoder.finish();
  active.delete(encoder);
  const label = `${String(seg.index + 1).padStart(2)} ${seg.type.padEnd(12)}`;
  console.log(`  scene ${label} ${seg.to - seg.from} frames rendered`);
}

/**
 * Draws every segment in `todo`. Each page takes the next open segment, so
 * `pages.length` segments are drawn at once. When one segment fails, the
 * other encoders are aborted, their pages are closed, and the first error
 * is thrown once everything has stopped.
 *
 * @param pages Ready film pages, one browser process each.
 * @throws UserError when ffmpeg fails.
 */
export async function drawSegments(
  pages: readonly FilmPage[],
  todo: readonly Segment[],
  settings: RenderSettings,
  options: DrawOptions,
): Promise<void> {
  let next = 0;
  const active = new Set<Encoder>();
  const workers = pages.map(async page => {
    while (next < todo.length) {
      const seg = todo[next++];
      if (seg) {
        await drawSegment(page, seg, settings, options, active);
      }
    }
  });
  try {
    await Promise.all(workers);
  } catch (e) {
    next = todo.length;
    for (const encoder of active) {
      encoder.abort();
    }
    await Promise.allSettled(pages.map(p => p.dispose()));
    await Promise.allSettled(workers);
    throw e;
  }
}
