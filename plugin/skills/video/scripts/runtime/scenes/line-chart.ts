/**
 * line-chart — one to three series drawn on left to right, a dot riding the line end, end value labels.
 * { type:"line-chart", duration, heading?, series:[{ name, values:[numbers] }] (1 to 3 series, 2+ points each,
 *   name required when there are 2+ series), labels?:[x labels] (one per point), prefix?, suffix?, decimals?,
 *   compact?, yMin?, yMax?, note? }
 * Series 1 uses the accent, series 2 the ink at lower opacity, series 3 the muted colour. Three to four light
 * gridlines with y labels; x labels are the first, the last and a few evenly spaced ones that fit.
 * yMin/yMax default to a nice axis (starting at 0 when the data are non-negative and the minimum is under 60% of
 * the maximum). Points outside yMin/yMax are clamped to the plot edge. A legend shows only with 2+ series.
 */

/** @fileoverview The `line-chart` scene: series that draw on over time. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import {compact, makeFail} from './lib/layout.ts';
import type {Axis} from './lib/line-axis.ts';
import {computeAxis, pickXLabels} from './lib/line-axis.ts';
import {addXLabels, addYLabels, drawGrid} from './lib/line-grid.ts';
import {buildLegend} from './lib/line-legend.ts';
import {measureChart} from './lib/line-measure.ts';
import {buildSeries, drawSeries} from './lib/line-series.ts';

/** One series of a `line-chart` scene. */
export interface LineSeries {
  /** Required when there are 2 or more series. */
  name?: string;
  /** At least 2 finite numbers. */
  values: number[];
}

/** Spec of a `line-chart` scene. */
export interface LineChartSceneSpec extends SceneSpec {
  type: 'line-chart';
  heading?: string;
  /** 1 to 3 series. */
  series: LineSeries[];
  /** X labels, one per point of the longest series. */
  labels?: string[];
  prefix?: string;
  suffix?: string;
  /** Decimals of the labels. Default: as many as the values need. */
  decimals?: number;
  compact?: boolean;
  /** Lower end of the y axis. */
  yMin?: number;
  /** Upper end of the y axis. */
  yMax?: number;
  note?: string;
}

interface ParsedSeries {
  name: string;
  values: number[];
}

function parseSeries(s: LineChartSceneSpec): {
  series: ParsedSeries[];
  nPts: number;
} {
  const fail = makeFail('');
  if (!Array.isArray(s.series) || !s.series.length) {
    fail('"series" is required: an array of 1 to 3 {name, values}');
  }
  if (s.series.length > 3) {
    fail(`"series" has ${s.series.length} items; at most 3 are supported`);
  }
  const series = s.series.map((r, i) => {
    if (!r || typeof r !== 'object') {
      fail(`series[${i}] must be an object {name, values}`);
    }
    if (!Array.isArray(r.values) || r.values.length < 2) {
      fail(`series[${i}].values must be an array of at least 2 numbers`);
    }
    if (r.values.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
      fail(`series[${i}].values must contain only finite numbers`);
    }
    if (
      s.series.length > 1 &&
      (r.name == null || String(r.name).trim() === '')
    ) {
      fail(`series[${i}].name is required when there are 2 or more series`);
    }
    return {name: r.name == null ? '' : String(r.name), values: r.values};
  });
  const nPts = Math.max(...series.map(r => r.values.length));
  if (s.labels != null) {
    if (!Array.isArray(s.labels)) {
      fail('"labels" must be an array of strings');
    }
    if (s.labels.length !== nPts) {
      fail(
        `"labels" has ${s.labels.length} items but the longest series ` +
          `has ${nPts} points`,
      );
    }
  }
  const finite = (v: unknown) => v == null || Number.isFinite(v);
  if (!finite(s.yMin)) {
    fail('"yMin" must be a number');
  }
  if (!finite(s.yMax)) {
    fail('"yMax" must be a number');
  }
  if (s.yMin != null && s.yMax != null && s.yMin >= s.yMax) {
    fail('"yMin" must be smaller than "yMax"');
  }
  return {series, nPts};
}

function axisFor(s: LineChartSceneSpec, all: readonly number[]): Axis {
  let dmin = Math.min(...all);
  let dmax = Math.max(...all);
  if (s.yMin == null && dmin >= 0 && dmin <= 0.6 * dmax) {
    dmin = 0;
  }
  if (dmax === dmin) {
    dmax = dmin + 1;
  }
  return computeAxis(dmin, dmax, s.yMin ?? undefined, s.yMax ?? undefined);
}

function clipLabel(l: unknown): string {
  const t = String(l);
  return t.length > 22 ? `${t.slice(0, 21).trimEnd()}…` : t;
}

registerScene('line-chart', (ctx, scene) => {
  const s = scene as LineChartSceneSpec;
  const {el, h, u} = ctx;
  const {series, nPts} = parseSeries(s);
  const xl = s.labels?.map(clipLabel);
  const axis = axisFor(
    s,
    series.flatMap(r => r.values),
  );
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const legend = buildLegend(ctx, series);
  const note = s.note ? ctx.text('div', 'rw-small', s.note) : null;
  const chart = h('div', {
    style: {
      position: 'relative',
      flex: '1 1 0',
      minHeight: '0',
      alignSelf: 'stretch',
    },
  });
  el.append(...compact([heading, legend, chart, note]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  if (note) {
    ctx.fit(note, {maxLines: 2});
  }
  if (legend) {
    ctx.enter(legend, 0.25, {y: 1.5});
  }
  const m = measureChart(ctx, chart, s, {axis, series, nPts, xl});
  const grid = drawGrid(ctx, chart, axis, m.g);
  const axisLayer = h('div', {style: {position: 'absolute', inset: '0'}});
  chart.append(axisLayer);
  addYLabels(ctx, axisLayer, axis, m.yTxt, m.g);
  if (xl) {
    const picks = pickXLabels(nPts, m.g.xAt, m.xW, 2 * u);
    addXLabels(ctx, axisLayer, picks, xl, m.xW, m.g);
  }
  ctx.enter(grid, 0.1, {y: 0, dur: 0.5});
  ctx.enter(axisLayer, 0.15, {y: 0, dur: 0.5});
  const {g, endTxts, endW} = m;
  const parts = buildSeries({ctx, chart, series, g, endTxts, endW, note});
  return t => drawSeries(ctx, parts, t);
});
