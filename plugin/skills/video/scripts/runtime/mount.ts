/**
 * @fileoverview Orchestration: resolves settings, builds the stage and the
 * scenes, publishes the film info and defines `renderAt`.
 * Every frame is a pure function of time: `renderAt(t)` reads no clock and no
 * state from an earlier frame.
 */

import type {Aspect, FilmInfo, FilmSpec} from '../shared/contract.ts';
import type {FrameGeometry} from './context.ts';
import {h} from './dom.ts';
import {recordError} from './errors.ts';
import {buildFilmInfo} from './film-info.ts';
import {loadFonts} from './fonts.ts';
import {createLayoutReport} from './layout-report.ts';
import {clamp, round3} from './math.ts';
import type {Overlays} from './overlays.ts';
import {createOverlays} from './overlays.ts';
import {startPlayer} from './player.ts';
import {sceneTypes} from './registry.ts';
import type {BuiltScene} from './scene-build.ts';
import {buildScenes} from './scene-build.ts';
import {applyCssVariables, resolveBrand} from './theme.ts';
import type {Timeline} from './timeline.ts';
import {computeTimeline, isOnScreen} from './timeline.ts';
import {applyTracks} from './tracks.ts';
import {layerLook} from './transitions.ts';
import type {ResolvedBrand, ResolvedMeta} from './types.ts';

/** Options of `mount`. */
export interface MountOptions {
  /** Render mode: no player, no scaling. Also set by `?render` in the URL. */
  render?: boolean;
}

/** Wide frames are landscape above this width-to-height ratio. */
const LANDSCAPE_RATIO = 1.2;
/** Tall frames are portrait below this width-to-height ratio. */
const PORTRAIT_RATIO = 0.83;

function sizeOverride(query: URLSearchParams): [number, number] | null {
  const [w, h] = (query.get('size') ?? '').split('x').map(Number);
  return w && h ? [w, h] : null;
}

function resolveMeta(spec: FilmSpec, query: URLSearchParams): ResolvedMeta {
  const m = spec.meta ?? {};
  const [width, height] = sizeOverride(query) ?? [
    m.width ?? 1920,
    m.height ?? 1080,
  ];
  return {
    title: m.title || '',
    width,
    height,
    fps: m.fps ?? 30,
    safe: m.safe ?? 6,
    background: m.background || 'plain',
    transition: m.transition ?? 'fade',
    transitionDuration: m.transitionDuration ?? 0.45,
    lead: m.lead,
    readingRate: m.readingRate ?? 0.3,
    maxHold: m.maxHold ?? 4,
    loop: !!m.loop,
    progress: !!m.progress,
    watermark: m.watermark || '',
    seed: m.seed || 0,
  };
}

function aspectOf(width: number, height: number): Aspect {
  const ratio = width / height;
  if (ratio > LANDSCAPE_RATIO) {
    return 'landscape';
  }
  return ratio < PORTRAIT_RATIO ? 'portrait' : 'square';
}

function createStage(
  meta: ResolvedMeta,
  brand: ResolvedBrand,
  geometry: FrameGeometry,
) {
  const stage = h('div', {id: 'rw-stage', 'data-aspect': geometry.aspect});
  stage.style.width = `${meta.width}px`;
  stage.style.height = `${meta.height}px`;
  applyCssVariables(stage, brand, meta, geometry.u);
  const viewport = h('div', {id: 'rw-viewport'}, stage);
  document.body.append(viewport);
  stage.append(h('div', {class: `rw-bg ${meta.background}`}));
  return {stage, viewport};
}

function waitForImages(stage: HTMLElement): Promise<unknown> {
  const pending = [...stage.querySelectorAll('img')].map(img =>
    img.complete && img.naturalWidth
      ? null
      : new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => {
            recordError(`image failed to load: ${img.getAttribute('src')}`);
            resolve();
          };
        }),
  );
  return Promise.all(pending);
}

/** Draws the scenes and overlays for film time `t`. */
function drawFrame(
  scenes: readonly BuiltScene[],
  meta: ResolvedMeta,
  u: number,
  t: number,
): void {
  const last = scenes.length - 1;
  for (const s of scenes) {
    const {start, duration, tin, tout} = s.slot;
    const local = t - start;
    if (!isOnScreen(local, duration, s.slot.index === last)) {
      s.layer.style.visibility = 'hidden';
      continue;
    }
    s.layer.style.visibility = 'visible';
    const look = layerLook(local, {
      duration,
      tin,
      tout,
      kind: meta.transition,
    });
    s.layer.style.opacity = String(round3(look.opacity));
    s.layer.style.transform = look.dx
      ? `translateX(${round3(look.dx * u)}px)`
      : '';
    for (const [el, list] of s.state.tracks) {
      applyTracks(el, list, local, u);
    }
    for (const fn of s.state.frameFns) {
      fn(local);
    }
  }
}

function createRenderer(
  scenes: readonly BuiltScene[],
  meta: ResolvedMeta,
  timeline: Timeline,
  u: number,
  overlays: Overlays,
) {
  let current = 0;
  const renderAt = (time: number) => {
    const t = clamp(time, 0, timeline.duration);
    drawFrame(scenes, meta, u, t);
    overlays.update(t, timeline.duration);
    current = t;
  };
  return {renderAt, getTime: () => current};
}

/** Everything `publish` needs. */
interface PageParts {
  stage: HTMLElement;
  viewport: HTMLElement;
  meta: ResolvedMeta;
  brand: ResolvedBrand;
  geometry: FrameGeometry;
  info: FilmInfo;
  renderAt: (t: number) => void;
  getTime: () => number;
  /** True in render mode: no player. */
  render: boolean;
}

/** Puts the page globals on `window`, draws frame 0 and sets `__ready`. */
function publish(p: PageParts): void {
  const {stage, viewport, meta, info, renderAt, getTime} = p;
  window.renderAt = renderAt;
  window.__film = info;
  window.__layoutReport = createLayoutReport({
    stage,
    width: meta.width,
    height: meta.height,
    safe: meta.safe * p.geometry.u,
    bg: p.brand.bg,
    getTime,
  });
  if (!p.render) {
    startPlayer({stage, viewport, film: info, renderAt, getTime});
  }
  renderAt(0);
  window.__ready = true;
}

/**
 * Mounts a film: builds the stage and scenes, then publishes `renderAt`,
 * `__film`, `__layoutReport` and `__ready` on `window`.
 * @param film The film spec. Custom scenes must already be registered.
 * @param opts Mount options.
 * @returns The published film info.
 * @throws Error for an invalid spec, with a message that says what to fix.
 */
export async function mount(
  film: FilmSpec,
  opts: MountOptions = {},
): Promise<FilmInfo> {
  const query = new URLSearchParams(location.search);
  const render = query.has('render') || !!opts.render;
  document.body.classList.toggle('rw-render', render);
  const meta = resolveMeta(film, query);
  const u = Math.min(meta.width, meta.height) / 100;
  const aspect = aspectOf(meta.width, meta.height);
  const geometry: FrameGeometry = {
    width: meta.width,
    height: meta.height,
    u,
    aspect,
  };
  const brand = resolveBrand(film.brand);
  const {stage, viewport} = createStage(meta, brand, geometry);
  const missingFonts = await loadFonts(brand, film.brand?.fontFiles);
  const timeline = computeTimeline(meta, film.scenes ?? [], sceneTypes());
  const slots = timeline.slots;
  const scenes = buildScenes({film, meta, brand, geometry, stage, slots});
  const captions = film.captions ?? [];
  const overlays = createOverlays(meta, captions);
  stage.append(overlays.el);
  await waitForImages(stage);
  const captionCount = captions.length;
  const info = buildFilmInfo({
    meta,
    timeline,
    scenes,
    aspect,
    missingFonts,
    captionCount,
  });
  const clock = createRenderer(scenes, meta, timeline, u, overlays);
  publish({stage, viewport, meta, brand, geometry, info, render, ...clock});
  return info;
}
