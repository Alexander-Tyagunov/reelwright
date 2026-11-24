/**
 * @fileoverview Arrows of the `flow` scene: an SVG line and arrow head that
 * draw from one box toward the next. Sizes are in pixels.
 */

import type {SceneContext} from '../../types.ts';

/** One arrow and the numbers needed to draw it. */
export interface Arrow {
  line: SVGElement;
  head: SVGElement;
  /** Width of the connector box. */
  w: number;
  /** Height of the connector box. */
  h: number;
  /** Space kept free at both ends. */
  pad: number;
  /** Size of the arrow head. */
  headSize: number;
}

/**
 * Puts an SVG arrow into a connector element that already has its size.
 * @param ctx Scene context.
 * @param connector The connector element. Its size is measured here.
 */
export function buildArrow(ctx: SceneContext, connector: HTMLElement): Arrow {
  const {h, u} = ctx;
  const w = connector.offsetWidth;
  const height = connector.offsetHeight;
  const stroke = {
    stroke: 'var(--muted)',
    'stroke-width': 0.4 * u,
    'stroke-linecap': 'round',
  };
  const line = h('line', stroke);
  const head = h('path', {
    fill: 'none',
    ...stroke,
    'stroke-linejoin': 'round',
  });
  connector.append(
    h(
      'svg',
      {
        width: w,
        height,
        viewBox: `0 0 ${w} ${height}`,
        style: {display: 'block'},
      },
      line,
      head,
    ),
  );
  return {line, head, w, h: height, pad: 0.8 * u, headSize: 1.5 * u};
}

/**
 * Draws an arrow at a progress.
 * @param a The arrow.
 * @param p Progress from 0 (nothing) to 1 (full arrow).
 * @param horizontal True for a left-to-right arrow, false for top-to-bottom.
 */
export function drawArrow(a: Arrow, p: number, horizontal: boolean): void {
  const hs = a.headSize;
  const set = (el: SVGElement, name: string, v: number | string) =>
    el.setAttribute(name, String(v));
  if (horizontal) {
    const x0 = a.pad;
    const x1 = a.w - a.pad;
    const y = a.h / 2;
    const tip = x0 + (x1 - x0) * p;
    set(a.line, 'x1', x0);
    set(a.line, 'y1', y);
    set(a.line, 'x2', tip.toFixed(2));
    set(a.line, 'y2', y);
    const back = (tip - hs).toFixed(2);
    const d = `M ${back} ${y - hs * 0.8} L ${tip.toFixed(2)} ${y} L ${back} ${y + hs * 0.8}`;
    set(a.head, 'd', d);
  } else {
    const y0 = a.pad;
    const y1 = a.h - a.pad;
    const x = a.w / 2;
    const tip = y0 + (y1 - y0) * p;
    set(a.line, 'x1', x);
    set(a.line, 'y1', y0);
    set(a.line, 'x2', x);
    set(a.line, 'y2', tip.toFixed(2));
    const back = (tip - hs).toFixed(2);
    const d = `M ${x - hs * 0.8} ${back} L ${x} ${tip.toFixed(2)} L ${x + hs * 0.8} ${back}`;
    set(a.head, 'd', d);
  }
  const visible = p > 0.03 ? '1' : '0';
  a.head.style.opacity = visible;
  a.line.style.opacity = visible;
}
