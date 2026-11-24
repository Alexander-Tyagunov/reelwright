/**
 * outro — closing card, centred; the last frame is a settled poster.
 * { type:"outro", duration, title, subtitle?, cta?, url?, logo? }
 * cta = text of a button-shaped chip, url = shown in mono under it, logo = image path relative to the film.json folder.
 */

/** @fileoverview The `outro` scene: closing title, button and address. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import {compact} from './lib/layout.ts';

/** Spec of an `outro` scene. */
export interface OutroSceneSpec extends SceneSpec {
  type: 'outro';
  /** Closing headline. Required, non-empty. */
  title: string;
  subtitle?: string;
  /** Text of the button-shaped chip. */
  cta?: string;
  /** Address shown in monospace under the button. */
  url?: string;
  /** Image path relative to the spec's folder. */
  logo?: string;
}

function buildLogo(ctx: SceneContext, src: string | undefined) {
  if (!src) {
    return null;
  }
  return ctx.h('img', {
    src,
    style: {
      height: 'calc(var(--u) * 10)',
      maxWidth: 'calc(var(--u) * 40)',
      objectFit: 'contain',
      alignSelf: 'center',
    },
  });
}

function buildCta(ctx: SceneContext, text: string | undefined) {
  if (!text) {
    return null;
  }
  return ctx.text('div', '', text, {
    style: {
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
      fontWeight: '700',
      fontSize: 'calc(var(--u) * 4)',
      lineHeight: '1.1',
      letterSpacing: '-0.01em',
      padding: 'calc(var(--u) * 2) calc(var(--u) * 5)',
      borderRadius: '999px',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
      marginTop: 'calc(var(--u) * 1.5)',
    },
  });
}

function buildUrl(ctx: SceneContext, text: string | undefined) {
  if (!text) {
    return null;
  }
  return ctx.text('div', 'rw-mono', text, {
    style: {
      fontSize: 'calc(var(--u) * 3.6)',
      color: 'var(--muted)',
      fontWeight: '560',
      maxWidth: '100%',
      overflowWrap: 'anywhere',
    },
  });
}

registerScene('outro', (ctx, scene) => {
  const s = scene as OutroSceneSpec;
  const {el, h} = ctx;
  if (typeof s.title !== 'string' || !s.title.trim()) {
    throw new Error('field "title" is required (a non-empty string)');
  }
  el.classList.add('center');
  const logo = buildLogo(ctx, s.logo);
  const title = ctx.text('h1', 'rw-h1', s.title, {style: {maxWidth: '100%'}});
  const rule = h('div', {class: 'rw-rule'});
  const sub = s.subtitle
    ? ctx.text('p', 'rw-sub', s.subtitle, {
        style: {maxWidth: 'calc(var(--u) * 110)'},
      })
    : null;
  const cta = buildCta(ctx, s.cta);
  const url = buildUrl(ctx, s.url);
  el.append(...compact([logo, title, rule, sub, cta, url]));
  const lines = ctx.aspect === 'landscape' ? 2 : 4;
  ctx.fit(title, {maxLines: lines, min: 0.4});
  if (cta) {
    ctx.fit(cta, {maxLines: 1, min: 0.75});
  }
  const words = ctx.words(title);
  // Everything settles by about 2.6 s; short scenes compress that.
  const k = Math.min(1, Math.max(0.5, (s.duration - 0.6) / 2.6));
  if (logo) {
    ctx.enter(logo, 0.1 * k, {y: 2});
  }
  const each = Math.min(0.08, 0.5 / words.length) * k;
  const end = ctx.stagger(words, 0.3 * k, each, {y: 4.5, dur: 0.7});
  if (sub) {
    ctx.enter(sub, Math.max(0, end - 0.35 * k), {y: 2});
  }
  const ctaAt = (sub ? 1.35 : 1.0) * k;
  if (cta) {
    ctx.pop(cta, ctaAt, {zeta: 0.8, omega: 16});
  }
  if (url) {
    ctx.enter(url, ctaAt + (cta ? 0.35 : 0) * k, {y: 1.6, dur: 0.55});
  }
  return t => {
    const p = ctx.ease.out(ctx.prog(t, 0.55 * k, 0.7));
    rule.style.transform = `scaleX(${p.toFixed(3)})`;
  };
});
