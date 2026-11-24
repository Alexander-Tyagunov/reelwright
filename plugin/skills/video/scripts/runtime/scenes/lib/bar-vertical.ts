/**
 * @fileoverview Vertical layout of the `bar-chart` scene: one column per bar
 * with the value on top. Sizes are in pixels.
 */

import type {Bar, BarDatum, BarEnv} from './bar-env.ts';
import {
  columnGap,
  FIRST_BAR,
  LABEL_SIZE,
  VALUE_SIZE,
  valueEl,
} from './bar-env.ts';
import {clampText} from './layout.ts';

function verticalColumn(
  env: BarEnv,
  d: BarDatum,
  i: number,
  slotW: number,
  plot: HTMLElement,
  labs: HTMLElement,
) {
  const {ctx} = env;
  const valEl = valueEl(env, i, {textAlign: 'center'});
  const barEl = ctx.h('div', {
    style: {
      width: `${Math.round(Math.min(slotW * 0.64, 18 * ctx.u))}px`,
      height: '0px',
      flex: 'none',
      background: env.colorOf(d),
      borderRadius: 'calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0 0',
    },
  });
  const colStyle = {
    flex: '1 1 0',
    minWidth: '0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 'calc(var(--u) * 1)',
  };
  plot.append(ctx.h('div', {style: colStyle}, valEl, barEl));
  const label = ctx.text('div', 'rw-body', d.label, {
    style: {
      width: `${slotW}px`,
      flex: 'none',
      textAlign: 'center',
      lineHeight: '1.2',
      fontSize: `calc(var(--u) * ${LABEL_SIZE * 0.94})`,
      fontWeight: d.highlight ? '700' : '500',
    },
  });
  labs.append(label);
  return {valEl, barEl, label};
}

/** Builds columns with the value on top and the label underneath. */
export function buildVertical(env: BarEnv): Bar[] {
  const {ctx, data, chart, avail} = env;
  const {u} = ctx;
  const gap = columnGap(u);
  const slotW = (avail.w - gap * (data.length - 1)) / data.length;
  const plot = ctx.h('div', {
    style: {
      flex: '1 1 0',
      minHeight: '0',
      display: 'flex',
      alignItems: 'stretch',
      gap: `${gap}px`,
    },
  });
  const base = ctx.h('div', {
    style: {
      height: 'calc(var(--u) * 0.16)',
      background: 'var(--line-strong)',
      marginTop: '0',
      flex: 'none',
    },
  });
  const labs = ctx.h('div', {
    style: {
      display: 'flex',
      gap: `${gap}px`,
      paddingTop: 'calc(var(--u) * 1.6)',
      flex: 'none',
    },
  });
  chart.append(plot, base, labs);
  const cols = data.map((d, i) => verticalColumn(env, d, i, slotW, plot, labs));
  for (const c of cols) {
    clampText(c.label, 3);
  }
  const plotH = Math.min(plot.offsetHeight, avail.w * 0.55);
  chart.style.flex = 'none';
  plot.style.flex = 'none';
  plot.style.height = `${plotH}px`;
  const maxLen = plotH - VALUE_SIZE * 1.2 * u - 1.2 * u;
  const bars = cols.map((c, i): Bar => {
    c.valEl.style.minWidth = `${Math.ceil(c.valEl.offsetWidth)}px`;
    const at = FIRST_BAR + i * env.stagger;
    ctx.enter(c.label, at, {y: 1.2, dur: 0.5});
    return {at, barEl: c.barEl, valEl: c.valEl, maxLen, vertical: true, i};
  });
  ctx.track(base, {at: 0.25, dur: 0.5, from: {opacity: 0}});
  return bars;
}
