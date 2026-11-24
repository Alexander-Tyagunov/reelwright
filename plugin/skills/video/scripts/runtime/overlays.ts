/**
 * @fileoverview Film-wide overlays: progress bar, watermark and captions.
 * They draw above every scene and depend only on film time.
 */

import type {Caption} from '../shared/contract.ts';
import {h} from './dom.ts';
import {round3} from './math.ts';
import type {ResolvedMeta} from './types.ts';

/** The overlay layer and its update function. */
export interface Overlays {
  /** The overlay element, to append to the stage. */
  readonly el: HTMLDivElement;
  /**
   * Draws the overlays for film time `t`.
   * @param t Film time in seconds.
   * @param duration Total film length in seconds.
   */
  update(t: number, duration: number): void;
}

const IMAGE_PATH = /\.(png|svg|jpe?g|webp)$/i;

/**
 * Creates the overlays that the spec asks for.
 * @param meta Resolved meta: `progress` and `watermark` choose the overlays.
 * @param captions Subtitle lines, with times in film seconds.
 */
export function createOverlays(
  meta: ResolvedMeta,
  captions: readonly Caption[],
): Overlays {
  const el = h('div', {id: 'rw-overlay'});
  const bar = meta.progress ? h('div', {class: 'rw-progress'}) : null;
  if (bar) {
    el.append(bar);
  }
  if (meta.watermark) {
    const mark = IMAGE_PATH.test(meta.watermark)
      ? h('img', {src: meta.watermark})
      : meta.watermark;
    el.append(h('div', {class: 'rw-watermark'}, mark));
  }
  const cap = captions.length ? h('div', {class: 'rw-caption'}) : null;
  if (cap) {
    cap.dataset.rwText = '1';
    el.append(cap);
  }
  return {
    el,
    update(t, duration) {
      if (bar) {
        bar.style.transform = `scaleX(${round3(t / duration)})`;
      }
      if (cap) {
        const line = captions.find(c => t >= c.at && t < c.at + c.dur);
        cap.style.visibility = line ? 'visible' : 'hidden';
        if (line && cap.textContent !== line.text) {
          cap.textContent = line.text;
        }
      }
    },
  };
}
