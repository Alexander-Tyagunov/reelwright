/**
 * @fileoverview Measuring of the `line-chart` scene: label text, label
 * widths and the plot geometry. Sizes are in pixels.
 */

import type {SceneContext} from '../../types.ts';
import {measureWidth} from './layout.ts';
import type {Axis} from './line-axis.ts';
import {decimalsOf} from './line-axis.ts';
import type {PlotGeometry} from './line-grid.ts';
import {TICK_SIZE} from './line-grid.ts';
import {END_SIZE} from './line-series.ts';

/** How labels are formatted. All fields are optional. */
export interface LabelFormat {
  prefix?: string;
  suffix?: string;
  /** Digits after the decimal point. Default: as many as the values need. */
  decimals?: number;
  compact?: boolean;
}

/** The data the measuring needs. */
export interface ChartData {
  axis: Axis;
  series: ReadonlyArray<{values: number[]}>;
  /** Number of points of the longest series. */
  nPts: number;
  /** X labels, one per point. */
  xl?: string[];
}

/** Label text formatters for tick values and end values. */
function formatters(ctx: SceneContext, f: LabelFormat, axis: Axis) {
  const stepDec = Math.max(...axis.ticks.map(decimalsOf));
  const pf = {
    prefix: f.prefix || '',
    suffix: f.suffix || '',
    compact: !!f.compact,
  };
  return {
    tick: (v: number) =>
      ctx.fmt(Math.abs(v) < 1e-9 ? 0 : v, {
        decimals: f.decimals ?? stepDec,
        ...pf,
      }),
    end: (v: number) =>
      ctx.fmt(v, {decimals: f.decimals ?? decimalsOf(v), ...pf}),
  };
}

/** Everything measured before the plot can be placed. */
export interface Metrics {
  g: PlotGeometry;
  yTxt: string[];
  endTxts: string[];
  endW: number;
  xW: number[];
}

/**
 * Sizes the chart box and measures labels and plot geometry.
 * @param ctx Scene context.
 * @param chart The chart box.
 * @param f Label format.
 * @param data Axis, series and x labels.
 */
export function measureChart(
  ctx: SceneContext,
  chart: HTMLElement,
  f: LabelFormat,
  data: ChartData,
): Metrics {
  const {u} = ctx;
  const {axis, series, nPts, xl} = data;
  const fmt = formatters(ctx, f, axis);
  const cw = Math.floor(chart.offsetWidth);
  const ratio = ctx.aspect === 'landscape' ? 0.52 : 0.9;
  const ch = Math.floor(Math.min(chart.offsetHeight, cw * ratio));
  chart.style.flex = 'none';
  chart.style.height = `${ch}px`;
  const probe = (text: string, size: number, weight = '500') =>
    measureWidth(ctx.el, text, 'rw-body', {
      fontSize: `calc(var(--u) * ${size})`,
      fontWeight: weight,
    });
  const yTxt = axis.ticks.map(fmt.tick);
  const yW = Math.max(...yTxt.map(t => probe(t, TICK_SIZE)));
  const endTxts = series.map(r => fmt.end(r.values[r.values.length - 1] ?? 0));
  const endW = Math.max(...endTxts.map(t => probe(t, END_SIZE, '700')));
  const xW = xl ? xl.map(t => probe(t, TICK_SIZE)) : [];
  const left = Math.max(yW + 2 * u, xl ? (xW[0] ?? 0) / 2 : 0);
  const right = cw - Math.max(endW + 2.6 * u, xl ? (xW.at(-1) ?? 0) / 2 : 0);
  const top = 2.4 * u;
  const bottom = ch - (xl ? 7.2 * u : 2 * u);
  const g: PlotGeometry = {
    cw,
    ch,
    left,
    right,
    top,
    bottom,
    xAt: i => left + (i * (right - left)) / (nPts - 1),
    yAt: v =>
      bottom -
      ctx.clamp((v - axis.lo) / (axis.hi - axis.lo), 0, 1) * (bottom - top),
  };
  return {g, yTxt, endTxts, endW, xW};
}
