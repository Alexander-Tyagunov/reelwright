/**
 * @fileoverview Fitting and emphasis of the `flow` diagram: shrinks type,
 * padding and arrows until everything fits, and paints the active box.
 */

import {lineCount} from '../../dom.ts';
import type {Layout, Parts} from './flow-build.ts';

/** Title and detail base sizes in `u`, indexed by the step count. */
const TITLE_BASE = {
  wide: [0, 0, 5.4, 5, 4.4, 3.8],
  tall: [0, 0, 5.2, 5, 4.4, 4],
};
const DETAIL_BASE = {
  wide: [0, 0, 3.8, 3.6, 3.3, 3.1],
  tall: [0, 0, 3.6, 3.5, 3.3, 3.1],
};
const MAX_SHRINKS = 14;

/** Sizes in `u` for the shrink factor `k`. */
function sizesFor(lay: Layout, k: number) {
  const {horizontal, n} = lay;
  const key = horizontal ? 'wide' : 'tall';
  const tBase = TITLE_BASE[key][n] ?? 4;
  const dBase = DETAIL_BASE[key][n] ?? 3.1;
  const many = n >= 4;
  const base = horizontal ? (many ? 4.4 : 6) : many ? 4.4 : 5.6;
  return {
    pad: Math.max(1.4, 2.8 * k),
    arrow: base * Math.max(k, 0.75),
    title: Math.max(3.6, tBase * k).toFixed(2),
    detail: Math.max(3, dBase * k).toFixed(2),
  };
}

/** Sets type, padding and arrow sizes for the shrink factor `k`. */
function applySizes(lay: Layout, parts: Parts, k: number): void {
  const sz = sizesFor(lay, k);
  for (const t of parts.titles) {
    t.style.fontSize = `calc(var(--u) * ${sz.title})`;
  }
  for (const d of parts.details) {
    if (d) {
      d.style.fontSize = `calc(var(--u) * ${sz.detail})`;
    }
  }
  for (const b of parts.boxes) {
    const x = sz.pad + 0.4;
    b.style.padding = `calc(var(--u) * ${sz.pad}) calc(var(--u) * ${x})`;
  }
  for (const c of parts.connectors) {
    c.style.width = lay.horizontal ? `calc(var(--u) * ${sz.arrow})` : '100%';
    c.style.height = lay.horizontal
      ? 'calc(var(--u) * 6)'
      : `calc(var(--u) * ${sz.arrow})`;
  }
}

/** True when a text fits its box and line limit. */
function textFits(e: HTMLElement | null, maxLines: number): boolean {
  return !e || (e.scrollWidth <= e.clientWidth + 1 && lineCount(e) <= maxLines);
}

/**
 * Shrinks type, padding and arrows together until the diagram fits.
 * @param lay Orientation and step count.
 * @param parts The built elements.
 * @param diagram The diagram element.
 * @param availH Height available to the diagram, in pixels.
 */
export function fitDiagram(
  lay: Layout,
  parts: Parts,
  diagram: HTMLElement,
  availH: number,
): void {
  const titleLines = lay.horizontal ? 3 : 2;
  const detailLines = lay.horizontal ? 5 : 3;
  const fits = () =>
    diagram.offsetHeight <= availH + 1 &&
    parts.titles.every(t => textFits(t, titleLines)) &&
    parts.details.every(d => textFits(d, detailLines));
  let k = 1;
  applySizes(lay, parts, k);
  for (let i = 0; i < MAX_SHRINKS && !fits(); i++) {
    k *= 0.94;
    applySizes(lay, parts, k);
  }
}

/**
 * Colours the active box by progress `p`.
 * @param parts The built elements.
 * @param active Index of the active step.
 * @param p Progress from 0 to 1. The text turns to the accent ink at 0.5.
 */
export function paintActive(parts: Parts, active: number, p: number): void {
  const pc = (p * 100).toFixed(1);
  const box = parts.boxes[active];
  const num = parts.numbers[active];
  const title = parts.titles[active];
  const detail = parts.details[active];
  if (!box || !num || !title) {
    return;
  }
  const mix = (to: string) => `color-mix(in srgb, var(--accent) ${pc}%, ${to})`;
  box.style.backgroundColor = mix('var(--surface)');
  box.style.borderColor = mix('var(--line)');
  const on = p >= 0.5;
  num.style.color = on ? 'var(--accent-ink)' : 'var(--accent)';
  title.style.color = on ? 'var(--accent-ink)' : 'var(--ink)';
  if (detail) {
    detail.style.color = on ? 'var(--accent-ink)' : 'var(--muted)';
  }
}
