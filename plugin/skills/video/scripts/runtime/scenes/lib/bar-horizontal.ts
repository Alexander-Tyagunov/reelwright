/**
 * @fileoverview Horizontal layout of the `bar-chart` scene: one row per bar
 * with the label on the left. Sizes are in pixels.
 */

import type {Bar, BarDatum, BarEnv} from './bar-env.ts';
import {FIRST_BAR, LABEL_SIZE, valueEl} from './bar-env.ts';
import {clampText, measureWidth} from './layout.ts';

/** Measures the layout numbers of the horizontal chart. */
function horizontalSizes(env: BarEnv) {
  const {ctx, data, chart, avail} = env;
  const {u} = ctx;
  const n = data.length;
  const landscape = ctx.aspect === 'landscape';
  const labelStyle = {
    fontSize: `calc(var(--u) * ${LABEL_SIZE})`,
    fontWeight: '700',
  };
  const natural = Math.max(
    ...data.map(d => measureWidth(ctx.el, d.label, 'rw-body', labelStyle)),
  );
  const labelW = Math.ceil(ctx.clamp(natural, 6 * u, avail.w * 0.4));
  const wanted =
    n <= 4 ? (landscape ? 13 : 16) * u : n <= 6 && !landscape ? 13 * u : 11 * u;
  const rowH = Math.min(wanted, chart.offsetHeight / n);
  const lines = rowH >= LABEL_SIZE * 1.2 * 2 * u + 0.8 * u ? 2 : 1;
  return {labelW, rowH, lines, axisGap: 2 * u};
}

interface HorizontalSizes {
  labelW: number;
  rowH: number;
  axisGap: number;
}

function horizontalRow(
  env: BarEnv,
  d: BarDatum,
  i: number,
  sz: HorizontalSizes,
) {
  const {ctx, chart} = env;
  const label = ctx.text('div', 'rw-body', d.label, {
    style: {
      width: `${sz.labelW}px`,
      flex: 'none',
      textAlign: 'right',
      lineHeight: '1.2',
      fontSize: `calc(var(--u) * ${LABEL_SIZE})`,
      fontWeight: d.highlight ? '700' : '500',
    },
  });
  const valEl = valueEl(env, i, {});
  const barEl = ctx.h('div', {
    style: {
      height: `${Math.round(sz.rowH * 0.6)}px`,
      width: '0px',
      flex: 'none',
      background: env.colorOf(d),
      borderRadius: '0 calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0',
    },
  });
  const track = ctx.h(
    'div',
    {
      style: {
        flex: '1 1 0',
        minWidth: '0',
        display: 'flex',
        alignItems: 'center',
        gap: 'calc(var(--u) * 1.6)',
        paddingLeft: 'calc(var(--u) * 0.16)',
      },
    },
    barEl,
    valEl,
  );
  const rowStyle = {
    height: `${sz.rowH}px`,
    display: 'flex',
    alignItems: 'center',
    gap: `${sz.axisGap}px`,
  };
  chart.append(ctx.h('div', {style: rowStyle}, label, track));
  return {label, valEl, barEl};
}

/** Builds rows with the label on the left and the bar to its right. */
export function buildHorizontal(env: BarEnv): Bar[] {
  const {ctx, data, chart, avail, maxValW} = env;
  const {u} = ctx;
  const {labelW, rowH, lines, axisGap} = horizontalSizes(env);
  chart.style.flex = 'none';
  chart.style.height = `${rowH * data.length}px`;
  chart.style.justifyContent = 'flex-start';
  const maxLen = avail.w - labelW - axisGap - maxValW - 1.6 * u - 0.5 * u;
  const sz = {labelW, rowH, axisGap};
  const rows = data.map((d, i) => horizontalRow(env, d, i, sz));
  const bars = rows.map((r, i): Bar => {
    clampText(r.label, lines);
    r.valEl.style.minWidth = `${Math.ceil(r.valEl.offsetWidth)}px`;
    const at = FIRST_BAR + i * env.stagger;
    return {at, barEl: r.barEl, valEl: r.valEl, maxLen, vertical: false, i};
  });
  const axis = ctx.h('div', {
    style: {
      position: 'absolute',
      left: `${labelW + axisGap}px`,
      top: '0',
      bottom: '0',
      width: 'calc(var(--u) * 0.16)',
      background: 'var(--line-strong)',
    },
  });
  chart.append(axis);
  ctx.track(axis, {at: 0.25, dur: 0.5, from: {opacity: 0}});
  rows.forEach((r, i) => {
    const at = FIRST_BAR + i * env.stagger;
    ctx.enter(r.label, at, {y: 0, x: -1.2, dur: 0.5});
  });
  return bars;
}
