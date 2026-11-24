/**
 * metric — one to three big numbers that count up.
 * { type:"metric", duration, heading?, items:[{ label, value, from?, decimals?, prefix?, suffix?, compact?, delta?, good?: bool, note? }] }
 * A single metric may be written flat: { type:"metric", label, value, ... }
 * note?: a small muted footnote under the tiles (scene level), entering after the last tile.
 */

/** @fileoverview The `metric` scene: tiles with counting numbers. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import {compact, innerBox} from './lib/layout.ts';

/** One metric tile. */
export interface MetricItem {
  label: string;
  /** Final value. The tile counts up to it. */
  value: number;
  /** Start value of the count. Default 0. */
  from?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Shortens large values to `k`, `M` and `B`. */
  compact?: boolean;
  /** Small chip next to the value, for example `"+12%"`. */
  delta?: string;
  /** `true` colours the chip green, `false` red, unset neutral. */
  good?: boolean;
  /** Small muted line in the tile. */
  note?: string;
}

/** Spec of a `metric` scene. Item fields may sit on the scene itself. */
export interface MetricSceneSpec extends SceneSpec, Partial<MetricItem> {
  type: 'metric';
  heading?: string;
  /** One to three tiles. Without it the scene itself is the only tile. */
  items?: MetricItem[];
  /** Footnote under the tiles. */
  note?: string;
}

function chipClass(it: MetricItem): string {
  const tone =
    it.good === false ? 'bad' : it.good === true ? 'good' : 'neutral';
  return `rw-chip ${tone}`;
}

function formatter(ctx: SceneContext, it: MetricItem) {
  return (v: number) =>
    ctx.fmt(v, {
      decimals: it.decimals || 0,
      prefix: it.prefix || '',
      suffix: it.suffix || '',
      compact: it.compact,
    });
}

function tileFontSize(ctx: SceneContext, n: number): number {
  if (n === 1) {
    return 20;
  }
  if (ctx.aspect === 'landscape') {
    return n === 2 ? 13 : 10.5;
  }
  return 11;
}

/** Size multiplier of stacked tiles. `shrinkStack` lowers it to fit. */
const TILE_K = 'var(--rw-tile-k, 1)';

/** One built tile and what its animation needs. */
interface Tile {
  it: MetricItem;
  tile: HTMLElement;
  num: HTMLElement;
  delta: HTMLElement | null;
  fmt: (v: number) => string;
}

/** Creates the tile and its texts. */
function buildTile(ctx: SceneContext, it: MetricItem, n: number): Tile {
  const fmt = formatter(ctx, it);
  const num = ctx.text('div', 'rw-h1 rw-num', fmt(it.value), {
    style: {
      fontSize: `calc(var(--u) * ${tileFontSize(ctx, n)} * ${TILE_K})`,
      whiteSpace: 'nowrap',
    },
  });
  num.dataset.rwNoHold = '1';
  const label = ctx.text('div', 'rw-sub', it.label, {
    style: {fontSize: 'calc(var(--u) * 3.3)'},
  });
  const delta = it.delta ? ctx.text('div', chipClass(it), it.delta) : null;
  const note = it.note ? ctx.text('div', 'rw-small', it.note) : null;
  const wide = n > 1 && ctx.aspect === 'landscape';
  const tile = ctx.h(
    'div',
    {
      class: n > 1 ? 'rw-card' : '',
      style: {
        flex: wide ? '1 1 0' : 'none',
        minWidth: '0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `calc(var(--u) * 1.6 * ${TILE_K})`,
        ...(n > 1 ? {padding: `calc(var(--u) * 3.2 * ${TILE_K})`} : {}),
      },
    },
    label,
    num,
    delta,
    note,
  );
  return {it, tile, num, delta, fmt};
}

/**
 * Makes stacked tiles smaller until the scene fits its safe area. Three
 * tiles under a heading are taller than a square frame at full size.
 */
function shrinkStack(ctx: SceneContext, wrap: HTMLElement): void {
  if (ctx.aspect === 'landscape') {
    return;
  }
  const first = ctx.el.firstElementChild as HTMLElement | null;
  const last = ctx.el.lastElementChild as HTMLElement | null;
  if (!first || !last) {
    return;
  }
  const room = innerBox(ctx.el).h;
  const height = () => last.offsetTop + last.offsetHeight - first.offsetTop;
  for (let k = 0.95; height() > room && k > 0.6; k -= 0.05) {
    wrap.style.setProperty('--rw-tile-k', k.toFixed(2));
  }
}

/** Adds the entrance, the chip pop and the count of one tile. */
function animateTile(ctx: SceneContext, t: Tile, i: number): void {
  const {it, tile, num, delta, fmt} = t;
  num.style.minWidth = `${Math.ceil(num.offsetWidth)}px`;
  const at = 0.35 + i * 0.3;
  ctx.enter(tile, at, {y: 3});
  if (delta) {
    ctx.pop(delta, at + 1.25);
  }
  const from = it.from ?? 0;
  ctx.onFrame(time => {
    const p = ctx.ease.out(ctx.prog(time, at + 0.15, 1.2));
    const v = p >= 1 ? it.value : from + (it.value - from) * p;
    const txt = fmt(v);
    if (num.textContent !== txt) {
      num.textContent = txt;
    }
  });
}

registerScene('metric', (ctx, scene) => {
  const s = scene as MetricSceneSpec;
  const {el, h} = ctx;
  const items = (s.items ?? [s as MetricItem & SceneSpec]).slice(0, 3);
  const n = items.length;
  el.classList.add('center');
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const wrap = h('div', {
    style: {
      display: 'flex',
      flexDirection: ctx.aspect === 'landscape' ? 'row' : 'column',
      gap: `calc(var(--u) * 3 * ${TILE_K})`,
      justifyContent: 'center',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    },
  });
  el.append(...compact([heading, wrap]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  const tiles = items.map(it => buildTile(ctx, it, n));
  wrap.append(...tiles.map(t => t.tile));
  const foot = s.note ? ctx.text('div', 'rw-small', s.note) : null;
  if (foot) {
    el.append(foot);
    ctx.fit(foot, {maxLines: 2});
  }
  shrinkStack(ctx, wrap);
  tiles.forEach((t, i) => {
    animateTile(ctx, t, i);
  });
  if (foot) {
    ctx.enter(foot, 0.35 + (n - 1) * 0.3 + 0.6, {y: 1.5});
  }
});
