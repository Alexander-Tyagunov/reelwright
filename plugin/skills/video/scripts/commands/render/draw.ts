/**
 * @fileoverview Draws and encodes segments, one per page, in parallel.
 */
import type {FilmPage} from '../../browser/film.ts';
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
  const format = png ? {format: 'png' as const} : {quality: 92};
  // Draw frames 0..N-1 of the segment, never frame N.
  for (let k = seg.from; k < seg.to; k++) {
    await page.eval(`window.renderAt(${k / fps})`);
    await encoder.write(await page.shot(format));
  }
  await encoder.finish();
  const label = `${String(seg.index + 1).padStart(2)} ${seg.type.padEnd(12)}`;
  console.log(`  scene ${label} ${seg.to - seg.from} frames rendered`);
}

/**
 * Draws every segment in `todo`. Each page takes the next open segment, so
 * `pages.length` segments are drawn at once.
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
  await Promise.all(
    pages.map(async page => {
      while (next < todo.length) {
        const seg = todo[next++];
        if (seg) {
          await drawSegment(page, seg, settings, options);
        }
      }
    }),
  );
}
