/**
 * @fileoverview Builds `window.__film`: scene timing and the reading-hold
 * figures of every registered text. Settle times come from the tracks, so
 * this runs once, after all scenes are built and images are loaded.
 */

import type {FilmInfo, TextInfo} from '../shared/contract.ts';
import {checkTime, readingHold} from './holds.ts';
import {round3} from './math.ts';
import type {BuiltScene} from './scene-build.ts';
import type {Timeline} from './timeline.ts';
import {elementSettle} from './tracks.ts';
import type {ResolvedMeta} from './types.ts';

/** Settings the film info repeats from the spec. */
export interface FilmInfoInput {
  meta: ResolvedMeta;
  timeline: Timeline;
  scenes: readonly BuiltScene[];
  aspect: FilmInfo['aspect'];
  /** Font families that could not be loaded. */
  missingFonts: string[];
  /** Number of caption lines in the spec. */
  captionCount: number;
  /** Load-time warnings. */
  warnings: string[];
}

/**
 * Collects the text figures of one scene. Also stores the scene's settle time
 * and rest time on the built scene.
 * @param built The scene.
 * @param readingRate Seconds of hold required per word.
 */
export function collectTexts(
  built: BuiltScene,
  readingRate: number,
): TextInfo[] {
  const {tracks, texts, settles} = built.state;
  const {duration, tout, start} = built.slot;
  const out: TextInfo[] = [];
  let sceneSettle = 0;
  for (const el of texts) {
    const text = (el.textContent ?? '').trim();
    if (!el.isConnected || !text) {
      continue;
    }
    const motion = built.state.motions.get(el);
    const settle = motion?.at ?? elementSettle(el, tracks, settles);
    const words = text.split(/\s+/).length;
    const figures = readingHold({
      settle,
      // Moving text is readable only while it is shown.
      duration: motion ? settle + motion.step * motion.speed.length : duration,
      tout: motion ? 0 : tout,
      words,
      readingRate,
      noHold: !!el.dataset.rwNoHold,
    });
    sceneSettle = Math.max(sceneSettle, Math.min(settle, duration));
    out.push({
      scene: built.ctx.index,
      type: built.spec.type,
      text: text.slice(0, 80),
      words,
      ...figures,
      ...(motion && {motion}),
    });
  }
  built.settle = sceneSettle;
  built.check = checkTime(start, duration, tout, sceneSettle);
  return out;
}

/**
 * Assembles the value published as `window.__film`.
 * @param input Settings, timeline and built scenes.
 */
export function buildFilmInfo(input: FilmInfoInput): FilmInfo {
  const {meta, timeline, scenes, aspect, missingFonts, captionCount} = input;
  const {warnings} = input;
  const texts = scenes.flatMap(s => collectTexts(s, meta.readingRate));
  return {
    title: meta.title,
    width: meta.width,
    height: meta.height,
    fps: meta.fps,
    duration: round3(timeline.duration),
    frames: timeline.frames,
    loop: meta.loop,
    aspect,
    overlap: timeline.overlap,
    globalOverlays: !!(meta.progress || captionCount),
    missingFonts,
    warnings,
    readingRate: meta.readingRate,
    maxHold: meta.maxHold,
    scenes: scenes.map(s => ({
      index: s.slot.index,
      type: s.spec.type,
      id: s.spec.id || null,
      start: round3(s.slot.start),
      end: round3(s.slot.end),
      duration: s.slot.duration,
      check: s.check,
    })),
    texts,
  };
}
