/**
 * compare — before/after or A-vs-B: two cards, the left enters first, then the right; items stagger in.
 * { type:"compare", duration, heading?,
 *   left:  { title, items:[ "text" ] (1 to 4), tone?: "bad"|"neutral" },     // default "neutral"
 *   right: { title, items:[ "text" ] (1 to 4), tone?: "good"|"accent" } }    // default "accent"
 * note?: a small muted footnote under the cards (scene level), entering after the last item.
 * Side by side in landscape, stacked in portrait and square. Items may also be written {text}. Item text is
 * shrunk, then cut with an ellipsis, if the cards would not fit the frame.
 */

/** @fileoverview The `compare` scene: two cards with icon lists. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {LeftTone, RightTone, Side, Tone} from './lib/compare-cards.ts';
import {buildCard, fitCards} from './lib/compare-cards.ts';
import {compact, innerBox, makeFail} from './lib/layout.ts';

/** One side of a `compare` scene. */
export interface CompareSide<T extends string> {
  title: string;
  /** 1 to 4 lines. A line is a string or `{text}`. */
  items: Array<string | {text: string}>;
  tone?: T;
}

/** Spec of a `compare` scene. */
export interface CompareSceneSpec extends SceneSpec {
  type: 'compare';
  heading?: string;
  left: CompareSide<LeftTone>;
  right: CompareSide<RightTone>;
  /** Footnote under the cards. */
  note?: string;
}

function parseSide(
  s: CompareSceneSpec,
  key: 'left' | 'right',
  allowed: readonly Tone[],
  fallback: Tone,
): Side {
  const fail = makeFail('compare: ');
  const o = s[key];
  if (!o || typeof o !== 'object') {
    fail(`"${key}" is required: { title, items:[...] }`);
  }
  if (o.title == null || String(o.title).trim() === '') {
    fail(`"${key}.title" is required`);
  }
  if (!Array.isArray(o.items) || !o.items.length) {
    fail(`"${key}.items" is required: an array of 1 to 4 strings`);
  }
  if (o.items.length > 4) {
    fail(`"${key}.items" has ${o.items.length} items; at most 4 fit`);
  }
  const tone: Tone = o.tone == null ? fallback : o.tone;
  if (!allowed.includes(tone)) {
    const names = allowed.map(a => `"${a}"`).join(', ');
    fail(`"${key}.tone" must be one of ${names}`);
  }
  const items = o.items.map((it, i) => {
    const t = typeof it === 'string' ? it : it?.text;
    if (t == null || String(t).trim() === '') {
      fail(`"${key}.items[${i}]" must be a non-empty string`);
    }
    return String(t);
  });
  return {title: String(o.title), items, tone};
}

registerScene('compare', (ctx, scene) => {
  const s = scene as CompareSceneSpec;
  const {el, h, u} = ctx;
  const sides: [Side, Side] = [
    parseSide(s, 'left', ['bad', 'neutral'], 'neutral'),
    parseSide(s, 'right', ['good', 'accent'], 'accent'),
  ];
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const landscape = ctx.aspect === 'landscape';
  const wrap = h('div', {
    style: {
      display: 'flex',
      flexDirection: landscape ? 'row' : 'column',
      gap: 'calc(var(--u) * 3)',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    },
  });
  const foot = s.note ? ctx.text('div', 'rw-small', s.note) : null;
  el.append(...compact([heading, wrap, foot]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  if (foot) {
    ctx.fit(foot, {maxLines: 2});
  }
  const cards = sides.map(side => {
    const c = buildCard(ctx, side);
    wrap.append(c.card);
    return c;
  });
  const availH = () =>
    innerBox(el).h -
    (heading ? heading.offsetHeight + 3 * u : 0) -
    (foot ? foot.offsetHeight + 3 * u : 0);
  fitCards(cards, wrap, availH, u);
  const n = sides[0].items.length + sides[1].items.length;
  const pace = ctx.clamp((s.duration - 3.2) / (n + 1), 0.2, 0.55);
  let at = 0.4;
  for (const c of cards) {
    ctx.enter(c.card, at, {y: 3, dur: 0.65});
    at += 0.35;
    c.items.forEach((it, i) => {
      ctx.enter(it.row, at + i * pace, {y: 2, dur: 0.5});
    });
    at += c.items.length * pace + 0.15;
  }
  if (foot) {
    ctx.enter(foot, at, {y: 1.5});
  }
});
