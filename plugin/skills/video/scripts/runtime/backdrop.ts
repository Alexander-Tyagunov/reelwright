/**
 * @fileoverview Backdrops: a scene that paints a picture the stylesheet does
 * not know about registers a sampler, so the layout gate can measure text
 * contrast against the pixels behind the text and not against a CSS colour.
 */

/** A box in frame pixels. */
export interface BackdropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Gives the average colour behind a box as a CSS colour, or `null`. */
export type Backdrop = (box: BackdropBox) => string | null;

const backdrops = new WeakMap<Element, Backdrop>();

/**
 * Registers the sampler of a scene layer.
 * @param layer The scene's layer element.
 */
export function registerBackdrop(layer: Element, sampler: Backdrop): void {
  backdrops.set(layer, sampler);
}

/**
 * Finds the sampler of a scene layer.
 * @returns The sampler, or `undefined` for a layer that has none.
 */
export function backdropOf(layer: Element): Backdrop | undefined {
  return backdrops.get(layer);
}
