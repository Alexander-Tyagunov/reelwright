/**
 * plate — a pre-rendered image sequence as the picture, with labels that follow tracked points and free texts on top.
 * { type:"plate", duration, plate, start?, fit?, labels?, texts?, cues? }
 * plate: path of tracks.json relative to the film.json folder, for example "plates/shot03/tracks.json". The frames are named by its frame_pattern.
 * start?: seconds into the plate at which the scene begins (default 0). The frame shown at scene time t is floor((t + start) * plate fps), held at the last frame when the plate ends (a load warning says so).
 * fit?: "cover" (default, fills the frame and crops) | "contain" (shows the whole picture with bars).
 * labels?: [{ track, text, sub?, from?, to?, side?, offset?, smooth?, follow?, leader?, variant? }]  up to 40
 *   track: a point name from tracks.json. text: the label. sub: a smaller second line.
 *   from, to: scene seconds, or { event, plus? } for a named frame of the plate (plus in seconds). Defaults: 0 and the scene end. The label is gone by `to`.
 *   side: "top" | "bottom" | "left" | "right" | "auto" (default: the side with the most room around the point's average place while the label shows).
 *   offset: gap between the point and the label box in u (default 5). leader: line and dot from label to point (default true).
 *   smooth: seconds of smoothing, 0 to 5 (default 0.6). The box glides along a low-passed copy of the track; the dot and the end of the leader stay on the exact point. 0 follows the point exactly.
 *   follow: "both" (default) | "x" (the box keeps one height, just clear of the point's highest moment while the label shows, plus offset) | "none" (the box stays where the point is at `from`; the leader stretches).
 *   variant: "tag" (default, small panel behind the text) | "plain" (text with a soft shadow only).
 *   A label is hidden while its point is not visible, and is kept inside the safe area (the leader stretches).
 * texts?: [{ text, class?, x, y, from?, to?, align? }]  free overlays. class is a type class (default "rw-body"). x and y are u from the top left, or "center". align: "left" (default) | "center" | "right" sets which edge x names.
 * cues?: sound cues at scene seconds, like on any scene: [{ at, kind: "tick"|"pop"|"whoosh"|"rise"|"chime"|"hit"|"boom"|"sting", gain?, duration? }]. They play only when meta.sound is on and change no pixel.
 */

/** @fileoverview The `plate` scene: a plate with tracked labels and texts. */

import type {SceneSpec} from '../../shared/contract.ts';
import {plateFrameAt, plateFramePath} from '../../shared/plate.ts';
import {registerBackdrop} from '../backdrop.ts';
import {registerPreload} from '../preload.ts';
import {registerScene} from '../registry.ts';
import {registerSettler} from '../settle.ts';
import {createFrameStore} from './lib/plate-frames.ts';
import {buildLabels} from './lib/plate-labels.ts';
import {addressOf, loadedPlate, loadPlate} from './lib/plate-load.ts';
import {fitRect} from './lib/plate-place.ts';
import {createSampler} from './lib/plate-sample.ts';
import {bindPlate} from './lib/plate-spec.ts';
import {buildTexts} from './lib/plate-texts.ts';

/** Spec of a `plate` scene. See the header for every field. */
export interface PlateSceneSpec extends SceneSpec {
  type: 'plate';
  /** Path of `tracks.json`, relative to the spec's folder. Required. */
  plate: string;
  /** Seconds into the plate at which the scene begins. Default 0. */
  start?: number;
  fit?: 'cover' | 'contain';
  labels?: unknown[];
  texts?: unknown[];
}

registerPreload('plate', loadPlate);

registerScene('plate', ctx => {
  const {plate, options} = loadedPlate(ctx.index);
  const {labels, texts} = bindPlate(options, plate, ctx.dur);
  const size = {w: ctx.W, h: ctx.H};
  const drawn = fitRect(size, {w: plate.width, h: plate.height}, options.fit);
  const picture = ctx.h('div', {
    style: {
      position: 'absolute',
      inset: '0',
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${drawn.w}px ${drawn.h}px`,
      backgroundPosition: `${drawn.x}px ${drawn.y}px`,
    },
  });
  ctx.el.append(picture);
  const paint = (url: string) => {
    picture.style.backgroundImage = `url("${url}")`;
  };
  const store = createFrameStore({
    fileOf: i => addressOf(plateFramePath(plate, options.plate, i)),
    count: plate.frames,
    onWanted: paint,
  });
  registerSettler(store.pending);
  registerBackdrop(ctx.el, createSampler(drawn, store));
  const area = {
    x: ctx.safe,
    y: ctx.safe,
    w: ctx.W - 2 * ctx.safe,
    h: ctx.H - 2 * ctx.safe,
  };
  const geo = {plate, start: options.start, drawn, area};
  const draw = [buildTexts(ctx, texts), buildLabels(ctx, geo, labels)];
  return t => {
    const url = store.want(plateFrameAt(plate, t + options.start));
    if (url) {
      paint(url);
    }
    for (const fn of draw) {
      fn?.(t);
    }
  };
});
