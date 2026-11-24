/**
 * title — opening or section card.
 * { type:"title", duration, title, kicker?, subtitle?, logo?, align?: "center"|"left",
 *   accent?: a substring of title; the words inside it are coloured with the accent (ignored if not found) }
 */

/** @fileoverview The `title` scene: kicker, headline, rule and subtitle. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import {compact} from './lib/layout.ts';
import {sceneChecks} from './lib/validate.ts';

/** Spec of a `title` scene. */
export interface TitleSceneSpec extends SceneSpec {
  type: 'title';
  /** Headline. Long titles shrink to fit 2 lines (4 when not landscape). */
  title: string;
  /** Small uppercase line above the headline. */
  kicker?: string;
  /** Muted line under the rule. */
  subtitle?: string;
  /** Image path relative to the spec's folder, shown above the text. */
  logo?: string;
  /** `center` (default) or `left`. */
  align?: 'center' | 'left';
  /** Substring of `title` whose words use the accent colour. */
  accent?: string;
}

const FIELDS = ['title', 'kicker', 'subtitle', 'logo', 'align', 'accent'];

function colourAccent(
  words: readonly HTMLElement[],
  full: string,
  accent: string,
): void {
  const from = full.indexOf(accent);
  if (from < 0) {
    return;
  }
  const to = from + accent.length;
  let k = 0;
  for (const m of full.matchAll(/\S+/g)) {
    const word = words[k];
    if (m.index < to && m.index + m[0].length > from && word) {
      word.style.color = 'var(--accent)';
    }
    k++;
  }
}

function buildLogo(ctx: SceneContext, s: TitleSceneSpec) {
  if (!s.logo) {
    return null;
  }
  return ctx.h('img', {
    src: s.logo,
    style: {
      height: 'calc(var(--u) * 9)',
      alignSelf: s.align === 'left' ? 'flex-start' : 'center',
    },
  });
}

registerScene('title', (ctx, scene) => {
  const s = scene as TitleSceneSpec;
  const {el, h} = ctx;
  sceneChecks(s, FIELDS).text('title', s.title);
  if (s.align !== 'left') {
    el.classList.add('center');
  }
  const logo = buildLogo(ctx, s);
  const kicker = s.kicker ? ctx.text('div', 'rw-kicker', s.kicker) : null;
  const title = ctx.text('h1', 'rw-h1', s.title, {
    style: {maxWidth: '100%'},
  });
  const rule = h('div', {class: 'rw-rule'});
  const sub = s.subtitle
    ? ctx.text('p', 'rw-sub', s.subtitle, {
        style: {maxWidth: 'calc(var(--u) * 120)'},
      })
    : null;
  el.append(...compact([logo, kicker, title, rule, sub]));
  ctx.fit(title, {maxLines: ctx.aspect === 'landscape' ? 2 : 4});
  const full = title.textContent ?? '';
  const words = ctx.words(title);
  if (s.accent) {
    colourAccent(words, full, String(s.accent));
  }
  // Images fade and move; scaling an <img> is not frame-exact in Chrome.
  if (logo) {
    ctx.enter(logo, 0.1, {y: 2});
  }
  if (kicker) {
    ctx.enter(kicker, 0.15, {y: 1.6});
  }
  const each = Math.min(0.08, 0.5 / words.length);
  const end = ctx.stagger(words, 0.3, each, {y: 4.5, dur: 0.75});
  if (sub) {
    ctx.enter(sub, end - 0.35, {y: 2});
  }
  return t => {
    const p = ctx.ease.out(ctx.prog(t, 0.55, 0.7));
    rule.style.transform = `scaleX(${p.toFixed(3)})`;
  };
});
