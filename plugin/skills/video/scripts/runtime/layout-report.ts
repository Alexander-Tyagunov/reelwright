/**
 * @fileoverview Geometry of every visible registered text at the current
 * time. The layout gate reads it through `window.__layoutReport()`. Sizes are
 * in frame pixels, even when the live preview scales the stage.
 */

import type {LayoutItem, LayoutReport} from '../shared/contract.ts';
import {round3} from './math.ts';

/** What the report needs to know about the stage. */
export interface ReportSource {
  stage: HTMLElement;
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Safe margin in pixels. */
  safe: number;
  /** Brand background colour, used when no element has a solid one. */
  bg: string;
  /** Gives the time of the last drawn frame, in seconds. */
  getTime: () => number;
}

/** True when the CSS colour is opaque enough to count as a background. */
function isSolid(color: string): boolean {
  const m = color.match(/[\d.]+/g);
  return !!m && (m.length < 4 || parseFloat(m[3] ?? '1') > 0.5);
}

function solidBg(el: Element, source: ReportSource): string {
  const stop = source.stage.parentElement;
  for (let n: Element | null = el; n && n !== stop; n = n.parentElement) {
    const color = getComputedStyle(n).backgroundColor;
    if (isSolid(color)) {
      return color;
    }
  }
  return source.bg;
}

/** Opacity of the element and its ancestors. 0 when it is not visible. */
function visibleOpacity(el: HTMLElement, stage: HTMLElement): number {
  let op = 1;
  let visible = true;
  for (let n: Element | null = el; n && n !== stage; n = n.parentElement) {
    const cs = getComputedStyle(n);
    op *= parseFloat(cs.opacity);
    if (cs.visibility === 'hidden' || cs.display === 'none') {
      visible = false;
    }
  }
  const words = [...el.querySelectorAll('.rw-w')];
  if (words.length) {
    op *= Math.min(...words.map(w => parseFloat(getComputedStyle(w).opacity)));
  }
  return visible ? op : 0;
}

function describe(
  el: HTMLElement,
  op: number,
  source: ReportSource,
  nextId: () => string,
): LayoutItem {
  const sr = source.stage.getBoundingClientRect();
  const k = sr.width / source.width;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const layer = el.closest<HTMLElement>('.rw-layer');
  const parent = el.parentElement?.closest<HTMLElement>('[data-rw-text]');
  const idOf = (node: HTMLElement) => {
    node.dataset.rwId ||= nextId();
    return Number(node.dataset.rwId);
  };
  const id = idOf(el);
  const fontSize = parseFloat(cs.fontSize);
  return {
    id,
    parent: parent ? idOf(parent) : null,
    scene: layer ? Number(layer.dataset.scene) : -1,
    text: (el.textContent ?? '').trim().slice(0, 60),
    opacity: round3(op),
    x: round3((r.left - sr.left) / k),
    y: round3((r.top - sr.top) / k),
    w: round3(r.width / k),
    h: round3(r.height / k),
    fontSize: round3(fontSize),
    color: cs.color,
    bg: solidBg(el, source),
    // Tight leading overshoots by a few pixels; that is not clipping.
    clipped:
      el.scrollWidth > el.clientWidth + 2 ||
      el.scrollHeight - el.clientHeight > 0.3 * fontSize,
  };
}

/**
 * Creates the function behind `window.__layoutReport`.
 * @param source Stage element, frame size, safe margin and clock.
 */
export function createLayoutReport(source: ReportSource): () => LayoutReport {
  let seq = 0;
  const nextId = () => String(++seq);
  return () => {
    const items: LayoutItem[] = [];
    for (const el of source.stage.querySelectorAll<HTMLElement>(
      '[data-rw-text]',
    )) {
      if (!(el.textContent ?? '').trim()) {
        continue;
      }
      const op = visibleOpacity(el, source.stage);
      if (op >= 0.05) {
        items.push(describe(el, op, source, nextId));
      }
    }
    return {
      t: source.getTime(),
      width: source.width,
      height: source.height,
      safe: round3(source.safe),
      items,
    };
  };
}
