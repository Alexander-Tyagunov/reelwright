/**
 * @fileoverview The drawn series of the `line-chart` scene: the paths, the
 * riding dots and the end value labels. Sizes are in pixels.
 */

import type {SceneContext} from '../../types.ts';
import type {PlotGeometry} from './line-grid.ts';

/** One series after layout. */
export interface SeriesPart {
  path: SVGElement;
  dot: SVGElement;
  /** Points of the line, in pixels. */
  pts: Array<[number, number]>;
  /** Length of each segment. */
  seg: number[];
  /** Total length of the line. */
  len: number;
  /** Scene-local second at which the line starts to draw. */
  at: number;
}

/** Input of `buildSeries`. */
export interface SeriesInput {
  ctx: SceneContext;
  chart: HTMLElement;
  series: ReadonlyArray<{name: string; values: number[]}>;
  g: PlotGeometry;
  /** Formatted end value of each series. */
  endTxts: readonly string[];
  /** Width of the widest end label, in pixels. */
  endW: number;
  /** The footnote, which enters after the lines are drawn. */
  note: HTMLElement | null;
}

/** Colour and opacity of each series, by index. */
export const STYLES: readonly SeriesStyle[] = [
  {color: 'var(--accent)', opacity: 1},
  {color: 'var(--ink)', opacity: 0.7},
  {color: 'var(--muted)', opacity: 1},
];
/** End label size in `u`. */
export const END_SIZE = 4;
/** Scene-local second at which the first line starts to draw. */
const FIRST_LINE = 0.6;

/** Colour and opacity of one series. */
interface SeriesStyle {
  color: string;
  opacity: number;
}

/** Seconds a line takes to draw. */
function drawTime(ctx: SceneContext): number {
  return ctx.clamp(ctx.dur * 0.34, 1.1, 2.2);
}

function lastOf(values: readonly number[]): number {
  return values[values.length - 1] ?? 0;
}

/** Spreads the end labels so they do not overlap. Returns y per series. */
function spreadLabels(endY: readonly number[], labelH: number, B: number) {
  const order = endY
    .map((_, j) => j)
    .sort((a, b) => (endY[a] ?? 0) - (endY[b] ?? 0));
  const ly = [...endY];
  for (let k = 1; k < order.length; k++) {
    const cur = order[k] ?? 0;
    const prev = order[k - 1] ?? 0;
    if ((ly[cur] ?? 0) - (ly[prev] ?? 0) < labelH) {
      ly[cur] = (ly[prev] ?? 0) + labelH;
    }
  }
  const lastIdx = order[order.length - 1] ?? 0;
  const over = (ly[lastIdx] ?? 0) - (B + labelH / 2);
  if (over > 0) {
    for (let k = order.length - 1; k >= 0; k--) {
      const idx = order[k] ?? 0;
      ly[idx] = (ly[idx] ?? 0) - over;
    }
  }
  return ly;
}

function pathLength(pts: ReadonlyArray<[number, number]>) {
  const seg: number[] = [];
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] ?? [0, 0];
    const b = pts[i] ?? [0, 0];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(d);
    len += d;
  }
  return {seg, len};
}

/** Builds the path and the dot of one series. */
function buildLine(
  ctx: SceneContext,
  style: SeriesStyle,
  pts: ReadonlyArray<[number, number]>,
  len: number,
) {
  const {u, h} = ctx;
  const d = `M${pts.map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L')}`;
  const path = h('path', {
    d,
    fill: 'none',
    stroke: style.color,
    'stroke-opacity': style.opacity,
    'stroke-width': 0.7 * u,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-dasharray': `${len.toFixed(2)} ${len.toFixed(2)}`,
    'stroke-dashoffset': len.toFixed(2),
  });
  const dot = h('circle', {
    r: 1.15 * u,
    fill: style.color,
    'fill-opacity': style.opacity,
    stroke: 'var(--bg)',
    'stroke-width': 0.35 * u,
    opacity: 0,
  });
  return {path, dot};
}

/** Builds the end value label of series `j`. */
function buildEndLabel(
  input: SeriesInput,
  j: number,
  x: number,
  y: number,
): HTMLElement {
  const {ctx, endTxts, endW} = input;
  const lab = ctx.text('div', 'rw-body', endTxts[j], {
    style: {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      fontSize: `calc(var(--u) * ${END_SIZE})`,
      fontWeight: '700',
      lineHeight: '1.3',
      whiteSpace: 'nowrap',
      color: j === 2 ? 'var(--muted)' : 'var(--ink)',
      opacity: j === 1 ? '0.85' : '1',
    },
  });
  lab.dataset.rwNoHold = '1';
  lab.style.minWidth = `${Math.ceil(endW)}px`;
  return lab;
}

/**
 * Builds the lines, dots and end labels, and declares their entrances.
 * @param input Context, chart box, data and geometry.
 * @returns One part per series, in series order.
 */
export function buildSeries(input: SeriesInput): SeriesPart[] {
  const {ctx, chart, series, g, note} = input;
  const {u, h} = ctx;
  const draw = drawTime(ctx);
  const offset = draw * 0.45;
  const labelH = END_SIZE * 1.3 * u;
  const lineSvg = h('svg', {
    viewBox: `0 0 ${g.cw} ${g.ch}`,
    width: g.cw,
    height: g.ch,
    style: {position: 'absolute', left: '0', top: '0', overflow: 'visible'},
  });
  chart.append(lineSvg);
  const endY = series.map(r => g.yAt(lastOf(r.values)));
  const ly = spreadLabels(endY, labelH, g.bottom);
  const parts: SeriesPart[] = [];
  for (let j = series.length - 1; j >= 0; j--) {
    const r = series[j];
    const style = STYLES[j];
    if (!r || !style) {
      continue;
    }
    const pts = r.values.map((v, i): [number, number] => [g.xAt(i), g.yAt(v)]);
    const {seg, len} = pathLength(pts);
    const at = FIRST_LINE + j * offset;
    const {path, dot} = buildLine(ctx, style, pts, len);
    lineSvg.append(path, dot);
    const x = g.xAt(r.values.length - 1) + 2.2 * u;
    const lab = buildEndLabel(input, j, x, (ly[j] ?? 0) - labelH / 2);
    chart.append(lab);
    ctx.enter(lab, at + draw * 0.92, {y: 0, x: -1, dur: 0.5});
    parts.push({path, dot, pts, seg, len, at});
  }
  if (note) {
    ctx.enter(note, FIRST_LINE + (series.length - 1) * offset + draw, {
      y: 1.5,
    });
  }
  return parts;
}

/**
 * Draws every series at scene-local time `t`.
 * @param ctx Scene context.
 * @param parts The parts from `buildSeries`.
 * @param t Scene-local time in seconds.
 */
export function drawSeries(
  ctx: SceneContext,
  parts: readonly SeriesPart[],
  t: number,
): void {
  const draw = drawTime(ctx);
  for (const q of parts) {
    const p = ctx.ease.inOut(ctx.prog(t, q.at, draw));
    q.path.setAttribute('stroke-dashoffset', (q.len * (1 - p)).toFixed(2));
    let target = q.len * p;
    let k = 0;
    while (k < q.seg.length - 1 && target > (q.seg[k] ?? 0)) {
      target -= q.seg[k] ?? 0;
      k++;
    }
    const segLen = q.seg[k] ?? 0;
    const f = segLen ? Math.min(1, target / segLen) : 0;
    const a = q.pts[k] ?? [0, 0];
    const b = q.pts[k + 1] ?? a;
    q.dot.setAttribute('cx', (a[0] + (b[0] - a[0]) * f).toFixed(2));
    q.dot.setAttribute('cy', (a[1] + (b[1] - a[1]) * f).toFixed(2));
    const op = ctx.clamp(ctx.prog(t, q.at, 0.25)).toFixed(3);
    q.dot.setAttribute('opacity', op);
  }
}
