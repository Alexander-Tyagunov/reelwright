/**
 * @fileoverview Samples the plate frame behind a text box, so the layout gate
 * can judge contrast against the picture. The result is the mean colour of
 * the pixels under the box; a box that covers both bright and dark areas is
 * judged against their average. It reads the decoded frame and never changes
 * what is drawn.
 */

import type {Backdrop} from '../../backdrop.ts';
import type {FrameStore} from './plate-frames.ts';
import type {Rect} from './plate-place.ts';

/** Side in pixels of the square the region is shrunk to before averaging. */
const GRID = 8;

/**
 * Makes the sampler of a plate scene.
 * @param drawn Where the plate image is drawn, in frame pixels.
 * @param store The plate's frame store; its wanted frame is sampled.
 * @returns A sampler that gives `rgb(r, g, b)`, or `null` while the frame
 *   is still loading or the box lies outside the picture.
 */
export function createSampler(drawn: Rect, store: FrameStore): Backdrop {
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const g = canvas.getContext('2d', {willReadFrequently: true});
  return box => {
    const img = store.current();
    if (!g || !img) {
      return null;
    }
    const kx = img.naturalWidth / drawn.w;
    const ky = img.naturalHeight / drawn.h;
    const sx = Math.max(0, (box.x - drawn.x) * kx);
    const sy = Math.max(0, (box.y - drawn.y) * ky);
    const sw = Math.min(img.naturalWidth, (box.x + box.w - drawn.x) * kx) - sx;
    const sh = Math.min(img.naturalHeight, (box.y + box.h - drawn.y) * ky) - sy;
    if (!(sw >= 1 && sh >= 1)) {
      return null;
    }
    g.drawImage(img, sx, sy, sw, sh, 0, 0, GRID, GRID);
    const px = g.getImageData(0, 0, GRID, GRID).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        sum[c] = (sum[c] ?? 0) + (px[i + c] ?? 0);
      }
    }
    const [r, gr, b] = sum.map(v => Math.round(v / (GRID * GRID)));
    return `rgb(${r}, ${gr}, ${b})`;
  };
}
