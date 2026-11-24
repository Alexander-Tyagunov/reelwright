/**
 * flow — explainer diagram: 2 to 5 boxes joined by arrows, revealed in order (box, then the arrow draws to the next).
 * { type:"flow", duration, heading?, steps:[{ title, detail? }]   (2 to 5; a plain string is a title)
 *   active?: index of the step to emphasise once everything is on screen (accent border and fill)
 *   note? }                                                         (small line under the diagram)
 * Horizontal in landscape, vertical in square and portrait.
 */

/** @fileoverview The `flow` scene: numbered boxes joined by arrows. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import {buildArrow, drawArrow} from './lib/flow-arrows.ts';
import type {FlowStep, Layout} from './lib/flow-build.ts';
import {buildDiagram} from './lib/flow-build.ts';
import {fitDiagram, paintActive} from './lib/flow-diagram.ts';
import {compact} from './lib/layout.ts';

/** Spec of a `flow` scene. */
export interface FlowSceneSpec extends SceneSpec {
  type: 'flow';
  heading?: string;
  /** 2 to 5 steps. A plain string is the title of a step. */
  steps: Array<string | FlowStep>;
  /** Zero-based index of the step to emphasise at the end. */
  active?: number;
  /** Small line under the diagram. */
  note?: string;
}

function parseSteps(s: FlowSceneSpec): FlowStep[] {
  if (!Array.isArray(s.steps) || s.steps.length < 2 || s.steps.length > 5) {
    throw new Error(
      'scene "flow": field "steps" is required and must hold 2 to 5 items ({title, detail?})',
    );
  }
  return s.steps.map((st, i) => {
    const o = typeof st === 'string' ? {title: st} : st;
    if (!o || typeof o.title !== 'string' || !o.title.trim()) {
      throw new Error(
        `scene "flow": steps[${i}] needs a non-empty string "title"`,
      );
    }
    return o;
  });
}

function parseActive(s: FlowSceneSpec, n: number): number {
  const active = s.active == null ? -1 : s.active;
  if (
    active !== -1 &&
    !(Number.isInteger(active) && active >= 0 && active < n)
  ) {
    throw new Error(
      `scene "flow": field "active" must be an integer from 0 to ${n - 1}, got ${JSON.stringify(s.active)}`,
    );
  }
  return active;
}

registerScene('flow', (ctx, scene) => {
  const s = scene as FlowSceneSpec;
  const {el, h, u} = ctx;
  const steps = parseSteps(s);
  const n = steps.length;
  const active = parseActive(s, n);
  const horizontal = ctx.aspect === 'landscape';
  const inline = !horizontal && ctx.aspect === 'square' && n >= 4;
  const lay: Layout = {horizontal, inline, n};
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const diagram = h('div', {
    style: {
      display: 'flex',
      flexDirection: horizontal ? 'row' : 'column',
      alignItems: 'stretch',
      alignSelf: 'stretch',
      flex: 'none',
    },
  });
  const note = s.note ? ctx.text('div', 'rw-small', s.note) : null;
  el.append(...compact([heading, diagram, note]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
  }
  const parts = buildDiagram(ctx, steps, diagram, lay);
  const extra = (e: HTMLElement | null) => (e ? e.offsetHeight + 3 * u : 0);
  const availH = el.clientHeight - 2 * ctx.safe - extra(heading) - extra(note);
  fitDiagram(lay, parts, diagram, availH);
  const arrows = parts.connectors.map(c => buildArrow(ctx, c));
  const ivl = ctx.clamp((s.duration - 0.35 - 0.55 - 1.6) / (n - 1), 0.6, 1.0);
  const boxAt = (i: number) => 0.35 + i * ivl;
  const allDone = boxAt(n - 1) + 0.55;
  if (heading) {
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  parts.wraps.forEach((wrap, i) => {
    ctx.enter(wrap, boxAt(i), {y: horizontal ? 2.4 : 2, dur: 0.55});
  });
  if (note) {
    ctx.enter(note, allDone, {y: 1.6});
  }
  const accentAt = allDone + 0.25;
  const activeBox = parts.boxes[active];
  if (activeBox) {
    // A small settle; it also tells the QA gates when the scene is at rest.
    ctx.track(activeBox, {
      at: accentAt,
      dur: 0.6,
      from: {scale: 0.985},
      ease: 'out',
    });
  }
  return t => {
    arrows.forEach((a, i) => {
      const p = ctx.ease.inOut(ctx.prog(t, boxAt(i) + 0.45, 0.45));
      drawArrow(a, p, horizontal);
    });
    if (active >= 0) {
      paintActive(parts, active, ctx.ease.inOut(ctx.prog(t, accentAt, 0.6)));
    }
  };
});
