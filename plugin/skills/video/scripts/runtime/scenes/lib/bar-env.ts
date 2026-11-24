/**
 * @fileoverview Types and helpers shared by the two layouts of the
 * `bar-chart` scene. Sizes are in pixels.
 */

import type {StyleObject} from '../../dom.ts';
import type {SceneContext} from '../../types.ts';
import type {Box} from './layout.ts';

/** One bar the frame function animates. */
export interface Bar {
  /** Scene-local second at which the bar starts to grow. */
  at: number;
  barEl: HTMLElement;
  valEl: HTMLElement;
  /** Length of the bar at the largest value, in pixels. */
  maxLen: number;
  /** True when the bar grows upward, false when it grows rightward. */
  vertical: boolean;
  /** Index into the data. */
  i: number;
}

/** One data point after validation. */
export interface BarDatum {
  label: string;
  value: number;
  highlight: boolean;
}

/** Everything a layout builder needs. */
export interface BarEnv {
  ctx: SceneContext;
  data: readonly BarDatum[];
  /** Final value labels, already formatted. */
  finals: readonly string[];
  colorOf: (d: BarDatum) => string;
  chart: HTMLElement;
  /** Inner size of the scene layer. */
  avail: Box;
  valStyle: StyleObject;
  /** Width of the widest final value label, in pixels. */
  maxValW: number;
  /** Seconds between the starts of two bars. */
  stagger: number;
}

/** Value label size in `u`. */
export const VALUE_SIZE = 3.6;
/** Category label size in `u`. */
export const LABEL_SIZE = 3.4;
/** Scene-local second at which the first bar starts. */
export const FIRST_BAR = 0.55;
/** Gap between vertical columns, in `u`. */
const COLUMN_GAP = 1.2;

/** Gap between vertical columns in pixels. */
export function columnGap(u: number): number {
  return COLUMN_GAP * u;
}

/** Creates the value label of bar `i`, with extra style. */
export function valueEl(
  env: BarEnv,
  i: number,
  extra: StyleObject,
): HTMLElement {
  const el = env.ctx.text('div', 'rw-body', env.finals[i], {
    style: {
      whiteSpace: 'nowrap',
      lineHeight: '1.2',
      color: 'var(--ink)',
      ...env.valStyle,
      ...extra,
    },
  });
  el.dataset.rwNoHold = '1';
  return el;
}
