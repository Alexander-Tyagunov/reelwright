/**
 * @fileoverview Callout boxes of the `image` scene: building them and
 * placing their label chips. Sizes are in pixels unless a name says `u` or
 * percent.
 */

import type {SceneContext} from '../../types.ts';

/** A highlighted region of the image. Numbers are percentages. */
export interface Callout {
  /** Left edge, percent of the drawn image width. */
  x: number;
  /** Top edge, percent of the drawn image height. */
  y: number;
  /** Width, percent of the drawn image width. */
  w: number;
  /** Height, percent of the drawn image height. */
  h: number;
  /** Text of the label chip. */
  label?: string;
  /** Scene-local second at which the callout draws in. */
  at?: number;
}

/** A built callout. */
export interface Mark {
  c: Callout;
  box: HTMLElement;
  chip: HTMLElement | null;
}

function buildChip(ctx: SceneContext, label: string): HTMLElement {
  return ctx.text('div', 'rw-chip', label, {
    style: {
      position: 'absolute',
      left: '0',
      top: '0',
      fontSize: 'calc(var(--u) * 3)',
      padding: 'calc(var(--u) * 0.7) calc(var(--u) * 1.6)',
      letterSpacing: '0.04em',
    },
  });
}

/**
 * Builds the callout boxes inside the zooming layer and declares their
 * entrances.
 * @param ctx Scene context.
 * @param callouts The callouts from the spec.
 * @param zoomer The layer that holds the picture and the boxes.
 */
export function buildMarks(
  ctx: SceneContext,
  callouts: readonly Callout[],
  zoomer: HTMLElement,
): Mark[] {
  return callouts.map((c, i) => {
    const box = ctx.h('div', {
      style: {
        position: 'absolute',
        left: `${c.x}%`,
        top: `${c.y}%`,
        width: `${c.w}%`,
        height: `${c.h}%`,
        border: 'calc(var(--u) * 0.5) solid var(--accent)',
        borderRadius: 'calc(var(--u) * 1)',
        boxSizing: 'border-box',
      },
    });
    const chip = c.label ? buildChip(ctx, c.label) : null;
    if (chip) {
      box.append(chip);
    }
    zoomer.append(box);
    const at = c.at == null ? 1 + i * 0.6 : c.at;
    const from = {opacity: 0, scale: 1.06};
    ctx.track(box, {at, dur: 0.5, from, ease: 'out'});
    if (chip) {
      const chipFrom = {opacity: 0, y: 1};
      ctx.track(chip, {at: at + 0.25, dur: 0.5, from: chipFrom, ease: 'out'});
    }
    return {c, box, chip};
  });
}

/**
 * Puts each label chip above its box, or below near the top edge, and keeps
 * it inside the image.
 * @param marks The built callouts.
 * @param w Drawn image width, in pixels.
 * @param hh Drawn image height, in pixels.
 * @param u One unit in pixels.
 */
export function placeChips(
  marks: readonly Mark[],
  w: number,
  hh: number,
  u: number,
): void {
  for (const m of marks) {
    if (!m.chip) {
      continue;
    }
    const {c, chip} = m;
    const bw = (w * c.w) / 100;
    const chipW = chip.offsetWidth;
    const chipH = chip.offsetHeight;
    const gap = 0.6 * u;
    const above = (c.y / 100) * hh >= chipH + gap + 0.5 * u;
    chip.style.top = above
      ? `${-(chipH + gap) - 0.5 * u}px`
      : `${(c.h / 100) * hh + gap - 0.5 * u}px`;
    const left = (c.x / 100) * w;
    const right = left + chipW > w - 0.5 * u;
    chip.style.left = right ? `${Math.min(0, bw - chipW)}px` : '0px';
    if (right && left + bw - chipW < 0.5 * u) {
      chip.style.left = `${0.5 * u - left}px`;
    }
  }
}
