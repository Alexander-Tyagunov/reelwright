/**
 * bullets — heading plus up to 5 short points, revealed one at a time.
 * { type:"bullets", duration, heading, items:[ "text" | {text, note?} ], numbered?: bool, pace?: seconds between items }
 */

/** @fileoverview The `bullets` scene: a heading and a staggered list. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import {compact} from './lib/layout.ts';
import {sceneChecks} from './lib/validate.ts';

/** One point of a `bullets` scene. */
export interface BulletItem {
  text: string;
  /** Small muted line under the text. */
  note?: string;
}

/** Spec of a `bullets` scene. */
export interface BulletsSceneSpec extends SceneSpec {
  type: 'bullets';
  heading?: string;
  /** Up to 5 points. A plain string is the text of a point. */
  items?: Array<string | BulletItem>;
  /** Shows `01`, `02`, ... in place of dots. */
  numbered?: boolean;
  /** Seconds between the starts of two points. Default from the duration. */
  pace?: number;
}

function buildMarker(
  ctx: SceneContext,
  numbered: boolean | undefined,
  i: number,
) {
  if (numbered) {
    return ctx.h('div', {
      class: 'rw-mono',
      style: {
        color: 'var(--accent)',
        fontWeight: '700',
        fontSize: 'calc(var(--u) * 3.4)',
        width: 'calc(var(--u) * 5)',
        flex: 'none',
      },
      text: String(i + 1).padStart(2, '0'),
    });
  }
  return ctx.h('div', {
    style: {
      width: 'calc(var(--u) * 1.5)',
      height: 'calc(var(--u) * 1.5)',
      borderRadius: '50%',
      background: 'var(--accent)',
      flex: 'none',
      marginTop: 'calc(var(--u) * 2.1)',
    },
  });
}

function buildRow(
  ctx: SceneContext,
  it: BulletItem,
  i: number,
  numbered: boolean | undefined,
): {row: HTMLElement; text: HTMLElement} {
  const marker = buildMarker(ctx, numbered, i);
  const text = ctx.text('div', 'rw-h3', it.text);
  const note = it.note
    ? ctx.text('div', 'rw-small', it.note, {
        style: {marginTop: 'calc(var(--u) * 0.5)'},
      })
    : null;
  const row = ctx.h(
    'div',
    {class: 'rw-row', style: {alignItems: 'flex-start'}},
    marker,
    ctx.h('div', {class: 'rw-grow'}, text, note),
  );
  return {row, text};
}

const FIELDS = ['heading', 'items', 'numbered', 'pace'];

/** Checks that the points are a list of strings or `{text}` objects. */
function checkItems(s: BulletsSceneSpec): void {
  const check = sceneChecks(s, FIELDS);
  const list = check.list('items', s.items, 1, 5);
  list.forEach((it, i) => {
    const text = typeof it === 'string' ? it : (it as BulletItem | null)?.text;
    check.text(`items[${i}]`, text);
  });
  check.optionalNumber('pace', s.pace);
}

registerScene('bullets', (ctx, scene) => {
  const s = scene as BulletsSceneSpec;
  const {el, h} = ctx;
  checkItems(s);
  const items = (s.items ?? [])
    .slice(0, 5)
    .map(it => (typeof it === 'string' ? {text: it} : it));
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const list = h('div', {
    class: 'rw-col',
    style: {gap: 'calc(var(--u) * 2.6)', marginTop: 'calc(var(--u) * 1.5)'},
  });
  el.append(...compact([heading, list]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
  }
  const rows = items.map((it, i) => {
    const built = buildRow(ctx, it, i, s.numbered);
    list.append(built.row);
    ctx.fit(built.text, {maxLines: 2});
    return built.row;
  });
  if (heading) {
    ctx.enter(heading, 0.15, {y: 2.5});
  }
  const spare = (s.duration - 2.6) / Math.max(1, rows.length);
  const pace = s.pace ?? ctx.clamp(spare, 0.25, 0.9);
  rows.forEach((row, i) => {
    ctx.enter(row, 0.65 + i * pace, {y: 2.4, dur: 0.55});
  });
});
