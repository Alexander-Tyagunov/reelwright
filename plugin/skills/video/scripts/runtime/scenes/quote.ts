/**
 * quote — one large quotation, words staggering in, attribution last.
 * { type:"quote", duration, quote, author?, role? }
 * The quote is fitted to at most 5 lines; the opening quotation mark is drawn in the accent colour.
 */

/** @fileoverview The `quote` scene: a large quotation and its source. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import {compact} from './lib/layout.ts';

/** Spec of a `quote` scene. */
export interface QuoteSceneSpec extends SceneSpec {
  type: 'quote';
  /** The quotation. Required, non-empty. */
  quote: string;
  author?: string;
  role?: string;
}

function buildMark(ctx: SceneContext, landscape: boolean): HTMLElement {
  return ctx.h('div', {
    'aria-hidden': 'true',
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: '800',
      color: 'var(--accent)',
      fontSize: `calc(var(--u) * ${landscape ? 20 : 17})`,
      lineHeight: '0.8',
      height: `calc(var(--u) * ${landscape ? 9 : 8})`,
      marginBottom: 'calc(var(--u) * 1)',
      overflow: 'visible',
    },
    text: '\u201C',
  });
}

function buildQuote(
  ctx: SceneContext,
  text: string,
  landscape: boolean,
  size: number,
): HTMLElement {
  return ctx.text('p', 'rw-h2', text, {
    style: {
      fontSize: `calc(var(--u) * ${size})`,
      fontWeight: '620',
      lineHeight: '1.16',
      letterSpacing: '-0.022em',
      maxWidth: `calc(var(--u) * ${landscape ? 132 : 100})`,
      width: '100%',
      margin: '0',
    },
  });
}

function buildWho(ctx: SceneContext, s: QuoteSceneSpec): HTMLElement | null {
  const author = s.author
    ? ctx.text('div', 'rw-h3', s.author, {
        style: {fontSize: 'calc(var(--u) * 4)'},
      })
    : null;
  const role = s.role ? ctx.text('div', 'rw-small', s.role) : null;
  if (!author && !role) {
    return null;
  }
  return ctx.h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'calc(var(--u) * 0.6)',
      },
    },
    author,
    role,
  );
}

registerScene('quote', (ctx, scene) => {
  const s = scene as QuoteSceneSpec;
  const {el, h} = ctx;
  if (typeof s.quote !== 'string' || !s.quote.trim()) {
    throw new Error('field "quote" is required (a non-empty string)');
  }
  el.classList.add('center');
  const landscape = ctx.aspect === 'landscape';
  const size = landscape ? 7.2 : 6.6;
  const mark = buildMark(ctx, landscape);
  const quote = buildQuote(ctx, s.quote.trim(), landscape, size);
  const rule = h('div', {
    class: 'rw-rule',
    style: {
      transformOrigin: 'center center',
      marginTop: 'calc(var(--u) * 1.2)',
    },
  });
  const who = buildWho(ctx, s);
  el.append(...compact([mark, quote, who && rule, who]));
  ctx.fit(quote, {maxLines: 5, min: 3.4 / size});
  const words = ctx.words(quote);
  ctx.track(mark, {
    at: 0.1,
    dur: 0.7,
    from: {opacity: 0, y: 2, scale: 0.88},
    ease: 'out',
  });
  const each = Math.min(0.07, 1.5 / words.length);
  const at = ctx.stagger(words, 0.5, each, {y: 3, dur: 0.65}) - 0.1;
  if (who) {
    ctx.enter(who, at + 0.1, {y: 2, dur: 0.6});
  }
  return t => {
    const p = ctx.ease.out(ctx.prog(t, at - 0.1, 0.6));
    rule.style.transform = `scaleX(${p.toFixed(3)})`;
  };
});
