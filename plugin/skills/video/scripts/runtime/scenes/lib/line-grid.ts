/**
 * @fileoverview Grid lines and axis labels of the `line-chart` scene.
 * Positions are in pixels inside the chart box.
 */

import type {StyleObject} from '../../dom.ts';
import type {SceneContext} from '../../types.ts';
import type {Axis} from './line-axis.ts';

/** Plot geometry inside the chart box, in pixels. */
export interface PlotGeometry {
  /** Chart box width. */
  cw: number;
  /** Chart box height. */
  ch: number;
  /** Left, right, top and bottom edge of the plot area, in pixels. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** X position of point `i`. */
  xAt: (i: number) => number;
  /** Y position of a data value, limited to the plot area. */
  yAt: (v: number) => number;
}

/** Tick label size in `u`. */
export const TICK_SIZE = 3.2;

/**
 * Draws the horizontal gridlines.
 * @param ctx Scene context.
 * @param chart The chart box.
 * @param axis The y axis.
 * @param g Plot geometry.
 */
export function drawGrid(
  ctx: SceneContext,
  chart: HTMLElement,
  axis: Axis,
  g: PlotGeometry,
): SVGElement {
  const {u} = ctx;
  const grid = ctx.h('svg', {
    viewBox: `0 0 ${g.cw} ${g.ch}`,
    width: g.cw,
    height: g.ch,
    style: {position: 'absolute', left: '0', top: '0', overflow: 'visible'},
  });
  for (const tv of axis.ticks) {
    const y = g.yAt(tv);
    const isBase = Math.abs(tv - axis.lo) < 1e-9;
    grid.append(
      ctx.h('line', {
        x1: g.left,
        x2: g.right,
        y1: y,
        y2: y,
        stroke: isBase ? 'var(--line-strong)' : 'var(--line)',
        'stroke-width': Math.max(1, (isBase ? 0.2 : 0.16) * u),
      }),
    );
  }
  chart.append(grid);
  return grid;
}

function tickLabel(ctx: SceneContext, text: string, style: StyleObject) {
  const lab = ctx.text('div', 'rw-small', text, {
    style: {
      fontSize: `calc(var(--u) * ${TICK_SIZE})`,
      lineHeight: '1.3',
      whiteSpace: 'nowrap',
      ...style,
    },
  });
  lab.dataset.rwNoHold = '1';
  return lab;
}

/**
 * Adds the y labels to a layer.
 * @param ctx Scene context.
 * @param layer The label layer.
 * @param axis The y axis.
 * @param texts Label text per tick.
 * @param g Plot geometry.
 */
export function addYLabels(
  ctx: SceneContext,
  layer: HTMLElement,
  axis: Axis,
  texts: readonly string[],
  g: PlotGeometry,
): void {
  const {u} = ctx;
  axis.ticks.forEach((tv, i) => {
    layer.append(
      tickLabel(ctx, texts[i] ?? '', {
        position: 'absolute',
        right: `${g.cw - g.left + 1.4 * u}px`,
        top: `${g.yAt(tv) - (TICK_SIZE * 1.3 * u) / 2}px`,
        textAlign: 'right',
      }),
    );
  });
}

/**
 * Adds the x labels at the chosen points to a layer.
 * @param ctx Scene context.
 * @param layer The label layer.
 * @param picks Point indices to label.
 * @param labels Label text per point.
 * @param widths Label width per point, in pixels.
 * @param g Plot geometry.
 */
export function addXLabels(
  ctx: SceneContext,
  layer: HTMLElement,
  picks: readonly number[],
  labels: readonly string[],
  widths: readonly number[],
  g: PlotGeometry,
): void {
  const {u} = ctx;
  for (const i of picks) {
    layer.append(
      tickLabel(ctx, labels[i] ?? '', {
        position: 'absolute',
        left: `${g.xAt(i) - (widths[i] ?? 0) / 2}px`,
        top: `${g.bottom + 2.2 * u}px`,
      }),
    );
  }
}
