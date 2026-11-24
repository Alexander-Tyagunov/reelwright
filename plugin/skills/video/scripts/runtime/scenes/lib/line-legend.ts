/**
 * @fileoverview Legend of the `line-chart` scene: a swatch and a name per
 * series. It shows only when there are two or more series.
 */

import type {SceneContext} from '../../types.ts';
import {STYLES} from './line-series.ts';

/**
 * Builds the legend.
 * @param ctx Scene context.
 * @param series Series names, in series order.
 * @returns The legend element, or `null` for fewer than two series.
 */
export function buildLegend(
  ctx: SceneContext,
  series: ReadonlyArray<{name: string}>,
): HTMLElement | null {
  if (series.length < 2) {
    return null;
  }
  const {h} = ctx;
  const items = series.map((r, i) =>
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'calc(var(--u) * 1.2)',
        },
      },
      h('div', {
        style: {
          width: 'calc(var(--u) * 3.6)',
          height: 'calc(var(--u) * 0.7)',
          borderRadius: '99px',
          background: STYLES[i]?.color ?? '',
          opacity: String(STYLES[i]?.opacity ?? 1),
          flex: 'none',
        },
      }),
      ctx.text('div', 'rw-small', r.name, {
        style: {fontSize: 'calc(var(--u) * 3.2)', color: 'var(--ink)'},
      }),
    ),
  );
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'calc(var(--u) * 1) calc(var(--u) * 3.6)',
      },
    },
    items,
  );
}
