/**
 * image — a screenshot or picture, optionally framed, with a slow zoom and accent callout boxes.
 * { type:"image", duration, src, heading?, caption?,
 *   fit?: "contain"|"cover"        (default "contain": the whole image is shown and the frame hugs it; "cover" fills the available area and crops)
 *   frame?: bool                   (default true: rounded card with a border)
 *   zoom?: number                  (default 1.04: slow scale from 1 to zoom over the scene; 1 = off)
 *   callouts?: [{ x, y, w, h, label?, at? }] }
 * src is relative to the film.json folder. Callout x, y, w, h are percentages of the image as drawn (for "cover", of the
 * frame). Each callout draws in at `at` seconds (default 1 s, then 0.6 s apart) with an optional label chip.
 */

/** @fileoverview The `image` scene: a framed picture with zoom and callouts. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import type {Callout, Mark} from './lib/image-marks.ts';
import {buildMarks, placeChips} from './lib/image-marks.ts';
import {compact} from './lib/layout.ts';

/** Spec of an `image` scene. */
export interface ImageSceneSpec extends SceneSpec {
  type: 'image';
  /** Image path relative to the spec's folder. Required. */
  src: string;
  heading?: string;
  caption?: string;
  /** `contain` (default) shows all of it, `cover` fills and crops. */
  fit?: 'contain' | 'cover';
  /** Draws a rounded card with a border. Default true. */
  frame?: boolean;
  /** End scale of the slow zoom, 1 to 2. Default 1.04. */
  zoom?: number;
  callouts?: Callout[];
}

function parseImage(s: ImageSceneSpec) {
  const fail = (m: string) => {
    throw new Error(m);
  };
  if (typeof s.src !== 'string' || !s.src) {
    fail('field "src" is required (a path relative to the film.json folder)');
  }
  const fit = s.fit || 'contain';
  if (!['contain', 'cover'].includes(fit)) {
    fail(`field "fit" must be "contain" or "cover", got "${fit}"`);
  }
  const zoom = s.zoom == null ? 1.04 : s.zoom;
  if (typeof zoom !== 'number' || !(zoom >= 1 && zoom <= 2)) {
    fail(
      'field "zoom" must be a number from 1 to 2, ' +
        `got ${JSON.stringify(s.zoom)}`,
    );
  }
  const callouts = s.callouts ?? [];
  if (!Array.isArray(callouts)) {
    fail('field "callouts" must be an array of {x, y, w, h, label?, at?}');
  }
  callouts.forEach((c, i) => {
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      if (typeof c[k] !== 'number') {
        fail(
          `callouts[${i}].${k} is required (a number, percent of the image)`,
        );
      }
    }
  });
  return {fit, zoom, callouts, framed: s.frame !== false};
}

/** The frame elements of an image scene. */
interface Frame {
  area: HTMLElement;
  frameBox: HTMLElement;
  zoomer: HTMLElement;
  img: HTMLImageElement;
}

/** The clipping card that holds the picture. */
function buildClip(ctx: SceneContext, framed: boolean): HTMLElement {
  return ctx.h('div', {
    style: {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      borderRadius: framed
        ? 'calc(var(--u) * var(--radius))'
        : 'calc(var(--u) * 0.8)',
      border: framed
        ? 'calc(var(--u) * 0.14) solid var(--line-strong)'
        : 'none',
      background: framed ? 'var(--surface)' : 'transparent',
    },
  });
}

/** The picture as a CSS background. */
function buildPicture(ctx: SceneContext, src: string, fit: string) {
  const url = String(src).replace(/"/g, '%22');
  return ctx.h('div', {
    style: {
      position: 'absolute',
      inset: '0',
      backgroundImage: `url("${url}")`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: fit,
    },
  });
}

/**
 * Builds the frame. The picture is a CSS background, never a scaled `<img>`
 * or `<canvas>`: Chrome caches scaled bitmaps, so a zooming `<img>` would
 * depend on the frames drawn before it. The hidden `<img>` gives the natural
 * size and makes the runtime wait for the file.
 */
function buildFrame(
  ctx: SceneContext,
  src: string,
  fit: string,
  framed: boolean,
): Frame {
  const {h} = ctx;
  const area = h('div', {
    style: {
      flex: '1 1 0',
      minHeight: '0',
      alignSelf: 'stretch',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  const frameBox = h('div', {
    style: {position: 'relative', flex: 'none', width: '10px', height: '10px'},
  });
  const clip = buildClip(ctx, framed);
  const zoomer = h('div', {
    style: {position: 'absolute', inset: '0', transformOrigin: 'center center'},
  });
  // The picture is a CSS background; the hidden <img> only gives its size.
  const img = h('img', {src, style: {display: 'none'}});
  zoomer.append(img, buildPicture(ctx, src, fit));
  clip.append(zoomer);
  frameBox.append(clip);
  area.append(frameBox);
  return {area, frameBox, zoomer, img};
}

/**
 * Makes the function that sizes the frame. The size is known only after the
 * file loads, so it runs once, in the first frame. The result does not
 * depend on time.
 */
function makeLayout(
  ctx: SceneContext,
  frame: Frame,
  fit: string,
  marks: readonly Mark[],
): () => void {
  const {area, frameBox, img} = frame;
  let laid = false;
  return () => {
    if (laid || !img.naturalWidth) {
      return;
    }
    laid = true;
    let w = area.offsetWidth;
    let hh = area.offsetHeight;
    if (fit === 'contain') {
      const k = Math.min(w / img.naturalWidth, hh / img.naturalHeight, 2);
      w = Math.round(img.naturalWidth * k);
      hh = Math.round(img.naturalHeight * k);
    }
    frameBox.style.width = `${w}px`;
    frameBox.style.height = `${hh}px`;
    if (fit === 'contain') {
      // Heading and caption sit next to the image.
      area.style.flex = 'none';
      area.style.height = `${hh}px`;
    }
    placeChips(marks, w, hh, ctx.u);
  };
}

registerScene('image', (ctx, scene) => {
  const s = scene as ImageSceneSpec;
  const {el} = ctx;
  const {fit, zoom, callouts, framed} = parseImage(s);
  el.classList.add('center');
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const caption = s.caption
    ? ctx.text('div', 'rw-sub', s.caption, {
        style: {
          fontSize: 'calc(var(--u) * 3.4)',
          maxWidth: 'calc(var(--u) * 120)',
        },
      })
    : null;
  const frame = buildFrame(ctx, s.src, fit, framed);
  el.append(...compact([heading, frame.area, caption]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
  }
  const marks = buildMarks(ctx, callouts, frame.zoomer);
  const layout = makeLayout(ctx, frame, fit, marks);
  if (heading) {
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  ctx.enter(frame.frameBox, 0.25, {y: 3, dur: 0.75});
  if (caption) {
    ctx.enter(caption, 0.7, {y: 2});
  }
  return t => {
    layout();
    const p = ctx.ease.inOut(ctx.prog(t, 0, ctx.dur));
    frame.zoomer.style.transform = `scale(${(1 + (zoom - 1) * p).toFixed(5)})`;
  };
});
