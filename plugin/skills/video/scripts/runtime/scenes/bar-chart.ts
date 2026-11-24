/**
 * bar-chart — up to 10 bars that grow from zero with a stagger; value labels count up and end on the exact value.
 * { type:"bar-chart", duration, heading?, data:[{ label, value, highlight?: bool }] (1 to 10 bars, value >= 0),
 *   unit?, prefix?, suffix?, decimals?, compact?, orientation?: "horizontal"|"vertical", note? }
 * unit is an alias of suffix (suffix wins). Highlighted bars use the accent, the rest a muted tone; with no
 * highlight every bar uses the accent. orientation defaults to vertical in landscape with 8 bars or fewer, otherwise
 * horizontal. A vertical chart whose columns are too narrow for the value labels falls back to horizontal.
 * Long labels are fitted, then cut with an ellipsis.
 */

/** @fileoverview The `bar-chart` scene: growing bars with counting labels. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import type {Bar, BarDatum, BarEnv} from './lib/bar-env.ts';
import {columnGap, FIRST_BAR, VALUE_SIZE} from './lib/bar-env.ts';
import {buildHorizontal} from './lib/bar-horizontal.ts';
import {buildVertical} from './lib/bar-vertical.ts';
import type {Box} from './lib/layout.ts';
import {compact, innerBox, makeFail, measureWidth} from './lib/layout.ts';

/** One bar of a `bar-chart` scene. */
export interface BarChartItem {
  label: string;
  /** Finite number, 0 or more. */
  value: number;
  /** Draws this bar in the accent colour. */
  highlight?: boolean;
}

/** Spec of a `bar-chart` scene. */
export interface BarChartSceneSpec extends SceneSpec {
  type: 'bar-chart';
  heading?: string;
  /** 1 to 10 bars. */
  data: BarChartItem[];
  /** Alias of `suffix`. `suffix` wins when both are set. */
  unit?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Shortens large values to `k`, `M` and `B`. */
  compact?: boolean;
  /** Default: vertical in landscape with 8 bars or fewer, else horizontal. */
  orientation?: 'horizontal' | 'vertical';
  note?: string;
}

const GROW = 0.9;

function parseData(s: BarChartSceneSpec): BarDatum[] {
  const fail = makeFail('');
  if (!Array.isArray(s.data) || !s.data.length) {
    fail('"data" is required: an array of {label, value} with 1 to 10 items');
  }
  if (s.data.length > 10) {
    fail(`"data" has ${s.data.length} items; at most 10 bars fit`);
  }
  const data = s.data.map((d, i) => {
    if (!d || typeof d !== 'object') {
      fail(`data[${i}] must be an object {label, value}`);
    }
    if (d.label == null || String(d.label).trim() === '') {
      fail(`data[${i}].label is required`);
    }
    if (typeof d.value !== 'number' || !Number.isFinite(d.value)) {
      fail(`data[${i}].value must be a finite number`);
    }
    if (d.value < 0) {
      fail(`data[${i}].value must be >= 0 (got ${d.value})`);
    }
    return {label: String(d.label), value: d.value, highlight: !!d.highlight};
  });
  const o = s.orientation;
  if (o != null && o !== 'horizontal' && o !== 'vertical') {
    fail('"orientation" must be "horizontal" or "vertical"');
  }
  return data;
}

/** Grows every bar and counts its value label up at time `t`. */
function drawBars(
  ctx: SceneContext,
  bars: readonly Bar[],
  data: readonly BarDatum[],
  maxV: number,
  fmt: (v: number) => string,
  t: number,
): void {
  for (const b of bars) {
    const d = data[b.i];
    if (!d) {
      continue;
    }
    const p = ctx.ease.out(ctx.prog(t, b.at, GROW));
    const len = Math.max(
      p > 0 ? 0.4 * ctx.u : 0,
      (d.value / maxV) * b.maxLen * p,
    );
    b.barEl.style[b.vertical ? 'height' : 'width'] = `${len.toFixed(2)}px`;
    const txt = fmt(p >= 1 ? d.value : d.value * p);
    if (b.valEl.textContent !== txt) {
      b.valEl.textContent = txt;
    }
    b.valEl.style.opacity = ctx.clamp(ctx.prog(t, b.at, 0.3)).toFixed(3);
  }
}

/** Picks vertical or horizontal bars for the available width. */
function chooseOrientation(
  ctx: SceneContext,
  s: BarChartSceneSpec,
  n: number,
  avail: Box,
  maxValW: number,
): 'horizontal' | 'vertical' {
  const {u} = ctx;
  const orient =
    s.orientation ||
    (ctx.aspect === 'landscape' && n <= 8 ? 'vertical' : 'horizontal');
  if (orient === 'vertical') {
    const slot = (avail.w - columnGap(u) * (n - 1)) / n;
    if (slot < maxValW + 0.8 * u || slot < 9 * u) {
      return 'horizontal';
    }
  }
  return orient;
}

/** Makes the function that formats a value as the spec asks. */
function makeFormat(ctx: SceneContext, s: BarChartSceneSpec) {
  return (v: number) =>
    ctx.fmt(v, {
      decimals: s.decimals || 0,
      prefix: s.prefix || '',
      suffix: s.suffix ?? s.unit ?? '',
      compact: !!s.compact,
    });
}

/** The heading, the chart box and the note, added to the scene. */
interface Frame {
  heading: HTMLElement | null;
  note: HTMLElement | null;
  chart: HTMLElement;
}

function buildFrame(ctx: SceneContext, s: BarChartSceneSpec): Frame {
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const note = s.note ? ctx.text('div', 'rw-small', s.note) : null;
  const chart = ctx.h('div', {
    style: {
      position: 'relative',
      flex: '1 1 0',
      minHeight: '0',
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
    },
  });
  ctx.el.append(...compact([heading, chart, note]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  if (note) {
    ctx.fit(note, {maxLines: 2});
  }
  return {heading, note, chart};
}

/** Bar colour: accent for highlighted bars, or for all when none is. */
function makeColorOf(data: readonly BarDatum[]) {
  const anyHighlight = data.some(d => d.highlight);
  return (d: BarDatum) =>
    d.highlight || !anyHighlight
      ? 'var(--accent)'
      : 'color-mix(in srgb, var(--muted) 55%, transparent)';
}

registerScene('bar-chart', (ctx, scene) => {
  const s = scene as BarChartSceneSpec;
  const data = parseData(s);
  const n = data.length;
  const fmt = makeFormat(ctx, s);
  const finals = data.map(d => fmt(d.value));
  const valStyle = {
    fontSize: `calc(var(--u) * ${VALUE_SIZE})`,
    fontWeight: '700',
  };
  const widths = finals.map(t =>
    measureWidth(ctx.el, t, 'rw-body rw-num', valStyle),
  );
  const {note, chart} = buildFrame(ctx, s);
  const avail = innerBox(ctx.el);
  const maxValW = Math.max(...widths);
  const stagger =
    n > 1 ? ctx.clamp((s.duration - 3.4) / (n - 1), 0.08, 0.3) : 0;
  const colorOf = makeColorOf(data);
  const env: BarEnv = {
    ctx,
    data,
    finals,
    colorOf,
    chart,
    avail,
    valStyle,
    maxValW,
    stagger,
  };
  const orient = chooseOrientation(ctx, s, n, avail, maxValW);
  const bars =
    orient === 'horizontal' ? buildHorizontal(env) : buildVertical(env);
  if (note) {
    ctx.enter(note, FIRST_BAR + (n - 1) * stagger + 0.5, {y: 1.5});
  }
  const maxV = Math.max(...data.map(d => d.value)) || 1;
  return t => drawBars(ctx, bars, data, maxV, fmt, t);
});
