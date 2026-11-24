/**
 * @fileoverview Scene transitions. Pure: the layer look at a scene-local time.
 * The outgoing scene clears before the incoming one lands, so text never
 * overlaps text.
 */

import type {TransitionKind} from '../shared/contract.ts';
import {ease} from './easing.ts';
import {prog} from './math.ts';

/** Slide distance of the `slide` transition, in `u`. */
const SLIDE_DISTANCE = 6;

/** Look of one scene layer at one time. */
export interface LayerLook {
  /** Layer opacity, 0 to 1. */
  opacity: number;
  /** Horizontal offset in `u`. 0 unless the transition is `slide`. */
  dx: number;
}

/** Transition lengths and kind of one scene. */
export interface LayerTiming {
  /** Seconds the scene is on screen. */
  duration: number;
  /** Seconds of the transition in. 0 for none. */
  tin: number;
  /** Seconds of the transition out. 0 for none. */
  tout: number;
  kind: TransitionKind;
}

/**
 * Opacity and offset of a scene layer.
 * @param local Seconds since the scene started.
 * @param timing Duration, transition lengths and kind.
 */
export function layerLook(local: number, timing: LayerTiming): LayerLook {
  const {duration, tin, tout, kind} = timing;
  const slide = kind === 'slide';
  let opacity = 1;
  let dx = 0;
  if (tin) {
    const p = prog(local, tin * 0.5, tin * 0.5);
    opacity *= ease.inOut(p);
    if (slide) {
      dx += (1 - ease.out(p)) * SLIDE_DISTANCE;
    }
  }
  if (tout) {
    const p = prog(local, duration - tout, tout * 0.5);
    opacity *= 1 - ease.inOut(p);
    if (slide) {
      dx -= ease.in(p) * SLIDE_DISTANCE;
    }
  }
  return {opacity, dx};
}
