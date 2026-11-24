/**
 * @fileoverview Builds the boxes and connectors of the `flow` scene. Sizes
 * are set later by the fitting step.
 */

import type {SceneContext} from '../../types.ts';

/** One step of a flow. */
export interface FlowStep {
  title: string;
  /** Optional muted text under the title. */
  detail?: string;
}

/** Orientation of the diagram. */
export interface Layout {
  horizontal: boolean;
  /** Title and detail sit side by side (square frames with 4+ steps). */
  inline: boolean;
  /** Number of steps. */
  n: number;
}

/** The built elements, one entry per step (connectors: one fewer). */
export interface Parts {
  wraps: HTMLElement[];
  boxes: HTMLElement[];
  titles: HTMLElement[];
  details: Array<HTMLElement | null>;
  numbers: HTMLElement[];
  connectors: HTMLElement[];
}

function buildTexts(
  ctx: SceneContext,
  st: FlowStep,
  i: number,
  inline: boolean,
) {
  const num = ctx.text('div', 'rw-mono', String(i + 1).padStart(2, '0'), {
    style: {
      color: 'var(--accent)',
      fontWeight: '700',
      fontSize: 'calc(var(--u) * 3.2)',
      flex: 'none',
    },
  });
  const title = ctx.text('div', '', st.title, {
    style: {
      flex: inline ? '0 1 42%' : '',
      fontWeight: '650',
      lineHeight: '1.18',
      letterSpacing: '-0.015em',
      overflowWrap: 'break-word',
      minWidth: '0',
    },
  });
  const detail = st.detail
    ? ctx.text('div', 'rw-muted', st.detail, {
        style: {
          lineHeight: '1.3',
          marginTop: inline ? '0' : 'calc(var(--u) * 0.8)',
          flex: inline ? '1 1 0' : '',
          minWidth: '0',
          overflowWrap: 'break-word',
        },
      })
    : null;
  return {num, title, detail};
}

function buildStep(
  ctx: SceneContext,
  st: FlowStep,
  i: number,
  lay: Layout,
  parts: Parts,
): void {
  const {h} = ctx;
  const {horizontal, inline} = lay;
  const {num, title, detail} = buildTexts(ctx, st, i, inline);
  const textCol = h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: inline ? 'row' : 'column',
        alignItems: inline ? 'baseline' : 'stretch',
        gap: 'calc(var(--u) * 2.4)',
        minWidth: '0',
        flex: horizontal ? '0 0 auto' : '1 1 0',
      },
    },
    title,
    detail,
  );
  const box = h(
    'div',
    {
      class: 'rw-card',
      style: {
        display: 'flex',
        flexDirection: horizontal ? 'column' : 'row',
        alignItems: horizontal ? 'stretch' : 'center',
        gap: 'calc(var(--u) * 1.6)',
        flex: '1 1 0',
        minWidth: '0',
        justifyContent: 'flex-start',
      },
    },
    num,
    textCol,
  );
  const wrapStyle = horizontal
    ? {flex: '1 1 0', minWidth: '0', display: 'flex'}
    : {display: 'flex', width: '100%'};
  parts.wraps.push(h('div', {style: wrapStyle}, box));
  parts.boxes.push(box);
  parts.titles.push(title);
  parts.details.push(detail);
  parts.numbers.push(num);
}

/**
 * Builds every step and the connectors between them.
 * @param ctx Scene context.
 * @param steps The validated steps.
 * @param diagram The element that receives the boxes.
 * @param lay Orientation and step count.
 */
export function buildDiagram(
  ctx: SceneContext,
  steps: readonly FlowStep[],
  diagram: HTMLElement,
  lay: Layout,
): Parts {
  const parts: Parts = {
    wraps: [],
    boxes: [],
    titles: [],
    details: [],
    numbers: [],
    connectors: [],
  };
  steps.forEach((st, i) => {
    buildStep(ctx, st, i, lay, parts);
    const wrap = parts.wraps[i];
    if (wrap) {
      diagram.append(wrap);
    }
    if (i < lay.n - 1) {
      const c = ctx.h('div', {
        style: lay.horizontal
          ? {flex: 'none', alignSelf: 'center'}
          : {flex: 'none', alignSelf: 'center', width: '100%'},
      });
      diagram.append(c);
      parts.connectors.push(c);
    }
  });
  return parts;
}
