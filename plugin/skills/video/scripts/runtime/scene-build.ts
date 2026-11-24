/**
 * @fileoverview Builds the DOM layer and the context of every scene, once,
 * before the first frame is drawn.
 */

import type {FilmSpec, SceneSpec} from '../shared/contract.ts';
import type {FrameGeometry, SceneState} from './context.ts';
import {createContext} from './context.ts';
import {h} from './dom.ts';
import {getScene} from './registry.ts';
import type {SceneSlot} from './timeline.ts';
import type {ResolvedBrand, ResolvedMeta, SceneContext} from './types.ts';

/** One built scene: its layer, context, state and timing. */
export interface BuiltScene {
  spec: SceneSpec;
  slot: SceneSlot;
  layer: HTMLDivElement;
  ctx: SceneContext;
  state: SceneState;
  /** Latest settle time of any text, in scene-local seconds. */
  settle: number;
  /** Film time at which the scene is at rest, in seconds. */
  check: number;
}

/** Shared inputs of every scene build. */
export interface BuildInput {
  film: FilmSpec;
  meta: ResolvedMeta;
  brand: ResolvedBrand;
  geometry: FrameGeometry;
  /** The stage that receives the scene layers. */
  stage: HTMLElement;
  slots: readonly SceneSlot[];
}

/**
 * Creates every scene layer and runs every scene factory.
 * @param input Film, resolved settings, stage and timeline slots.
 * @throws Error when a scene type is unknown or a factory throws.
 */
export function buildScenes(input: BuildInput): BuiltScene[] {
  const {film, meta, brand, geometry, stage, slots} = input;
  return slots.map(slot => {
    const spec = film.scenes[slot.index];
    const factory = spec && getScene(spec.type);
    if (!spec || !factory) {
      throw new Error(`scene ${slot.index + 1}: no factory for its type`);
    }
    const layer = h('div', {
      class: 'rw-layer',
      'data-scene': slot.index,
      'data-type': spec.type,
    });
    stage.append(layer);
    const index = slot.index;
    const {ctx, state} = createContext({
      film,
      meta,
      brand,
      geometry,
      scene: spec,
      index,
      layer,
    });
    const frameFn = factory(ctx, spec);
    if (typeof frameFn === 'function') {
      ctx.onFrame(frameFn);
    }
    return {spec, slot, layer, ctx, state, settle: 0, check: 0};
  });
}
