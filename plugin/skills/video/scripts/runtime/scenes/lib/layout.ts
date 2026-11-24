/**
 * @fileoverview Layout helpers shared by scene files: measuring, cutting text
 * with an ellipsis and validating input. All sizes are in pixels.
 */

import type {StyleObject} from '../../dom.ts';
import {h} from '../../dom.ts';

/** Width and height of an element's content box, in pixels. */
export interface Box {
  w: number;
  h: number;
}

/**
 * Removes empty values from a list of child elements.
 * @param items Elements mixed with `false`, `null`, `undefined` or `''`.
 */
export function compact<T>(
  items: ReadonlyArray<T | false | null | undefined | ''>,
): T[] {
  return items.filter((x): x is T => !!x);
}

/**
 * Creates the error thrower of a scene.
 * @param prefix Text put before every message, for example `'compare: '`.
 * @returns A function that throws an `Error` with the prefix and message.
 */
export function makeFail(prefix: string): (message: string) => never {
  return message => {
    throw new Error(prefix + message);
  };
}

/**
 * Size of the area inside the padding of an element.
 * @param el A scene layer, for example `ctx.el`.
 */
export function innerBox(el: HTMLElement): Box {
  const cs = getComputedStyle(el);
  return {
    w:
      el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    h:
      el.clientHeight -
      parseFloat(cs.paddingTop) -
      parseFloat(cs.paddingBottom),
  };
}

/**
 * Measures the width a text would have on one line.
 * @param parent Element that hosts the hidden probe, usually `ctx.el`.
 * @param text The text to measure.
 * @param cls Class of the probe, for example `'rw-body'`.
 * @param style Extra style, for example the font size.
 * @returns Width in pixels.
 */
export function measureWidth(
  parent: HTMLElement,
  text: string,
  cls: string,
  style: StyleObject,
): number {
  const probe = h('span', {
    class: cls,
    style: {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'nowrap',
      ...style,
    },
  });
  probe.textContent = text;
  parent.append(probe);
  const width = probe.offsetWidth;
  probe.remove();
  return width;
}

/**
 * Cuts the text of an element with an ellipsis until it fits.
 * @param node The element. Its box must already be laid out.
 * @param maxLines Most lines the text may use.
 */
export function clampText(node: HTMLElement, maxLines: number): void {
  const cs = getComputedStyle(node);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
  const over = () =>
    node.scrollWidth > node.clientWidth + 1 ||
    node.scrollHeight > lh * maxLines + 2;
  if (!over()) {
    return;
  }
  const full = node.textContent ?? '';
  let lo = 1;
  let hi = full.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    node.textContent = `${full.slice(0, mid).trimEnd()}…`;
    if (over()) {
      hi = mid - 1;
    } else {
      lo = mid;
    }
  }
  let cut = full.slice(0, lo);
  const space = cut.lastIndexOf(' ');
  if (space > lo * 0.5) {
    cut = cut.slice(0, space);
  }
  node.textContent = `${cut.trimEnd()}…`;
}
