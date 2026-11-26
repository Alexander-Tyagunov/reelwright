/**
 * @fileoverview Free text overlays of a `plate` scene: copy at a fixed place
 * in the frame that fades in at `from` and, when `to` is set, out by `to`.
 * Positions are in `u` from the top left corner; times are scene-local
 * seconds.
 */

import {round3} from '../../math.ts';
import type {SceneContext} from '../../types.ts';
import {FADE_S} from './plate-labels.ts';
import type {BoundText} from './plate-spec.ts';

/** Rise in `u` of a text while it fades in. */
const RISE_U = 1.5;
/** Seconds between the samples that describe a still text. */
const STILL_STEP_S = 0.1;

const ANCHOR = {left: '0%', center: '-50%', right: '-100%'} as const;

/** Widest the text may grow, in pixels, so it stays inside the safe area. */
function widthLimit(ctx: SceneContext, t: BoundText): number {
  const room = (v: number) => Math.max(0, v);
  if (t.x === 'center' || t.align === 'center') {
    const x = t.x === 'center' ? ctx.W / 2 : t.x * ctx.u;
    return room(2 * Math.min(x - ctx.safe, ctx.W - ctx.safe - x));
  }
  const x = t.x * ctx.u;
  return room(t.align === 'left' ? ctx.W - ctx.safe - x : x - ctx.safe);
}

function buildOne(ctx: SceneContext, t: BoundText) {
  const centered = t.x === 'center';
  const align = centered ? 'center' : t.align;
  const el = ctx.text('div', t.cls, t.text, {
    style: {
      width: 'max-content',
      maxWidth: `${round3(widthLimit(ctx, t))}px`,
      textAlign: align,
    },
  });
  const left = centered ? '50%' : `calc(var(--u) * ${t.x})`;
  const top = t.y === 'center' ? '50%' : `calc(var(--u) * ${t.y})`;
  const shiftY = t.y === 'center' ? '-50%' : '0%';
  const place = ctx.h('div', {
    style: {
      position: 'absolute',
      left,
      top,
      transform: `translate(${ANCHOR[align]}, ${shiftY})`,
    },
  });
  place.append(el);
  ctx.el.append(place);
  return el;
}

/**
 * Builds the text overlays. Texts without an end enter on a track; texts
 * with an end are driven by the returned function, and their reading window
 * is recorded so the holds gate measures it.
 *
 * @param ctx Scene context. The texts are added to `ctx.el`.
 * @param texts Texts with resolved times.
 * @returns The per-frame function, or `null` when no text needs one.
 */
export function buildTexts(
  ctx: SceneContext,
  texts: readonly BoundText[],
): ((t: number) => void) | null {
  const timed: Array<{el: HTMLElement; text: BoundText}> = [];
  for (const text of texts) {
    const el = buildOne(ctx, text);
    if (text.to === null) {
      ctx.enter(el, text.from, {dur: FADE_S, y: RISE_U});
      continue;
    }
    const at = text.from + FADE_S;
    const count = Math.max(
      0,
      Math.floor((text.to - FADE_S - at) / STILL_STEP_S),
    );
    ctx.motion(el, {at, step: STILL_STEP_S, speed: Array(count).fill(0)});
    timed.push({el, text});
  }
  if (!timed.length) {
    return null;
  }
  return t => {
    for (const {el, text} of timed) {
      const inn = ctx.ease.out(ctx.prog(t, text.from, FADE_S));
      const out = ctx.prog(t, (text.to ?? 0) - FADE_S, FADE_S);
      el.style.opacity = String(round3(inn * (1 - out)));
      const rise = round3((1 - inn) * RISE_U * ctx.u);
      el.style.transform = `translateY(${rise}px)`;
    }
  };
}
