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
import type {SceneContext, SceneFrameFn} from '../types.ts';
import {buildArrow, drawArrow} from './lib/flow-arrows.ts';
import type {FlowStep, Layout, Parts} from './lib/flow-build.ts';
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
      'field "steps" is required and must hold 2 to 5 items ({title, detail?})',
    );
  }
  return s.steps.map((st, i) => {
    const o = typeof st === 'string' ? {title: st} : st;
    if (!o || typeof o.title !== 'string' || !o.title.trim()) {
      throw new Error(`steps[${i}] needs a non-empty string "title"`);
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
      `field "active" must be an integer from 0 to ${n - 1}, ` +
        `got ${JSON.stringify(s.active)}`,
    );
  }
  return active;
}

/** The heading, the diagram box and the note, added to the scene. */
interface Frame {
  heading: HTMLElement | null;
  note: HTMLElement | null;
  diagram: HTMLElement;
}

function buildFrame(ctx: SceneContext, s: FlowSceneSpec, lay: Layout): Frame {
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const diagram = ctx.h('div', {
    style: {
      display: 'flex',
      flexDirection: lay.horizontal ? 'row' : 'column',
      alignItems: 'stretch',
      alignSelf: 'stretch',
      flex: 'none',
    },
  });
  const note = s.note ? ctx.text('div', 'rw-small', s.note) : null;
  ctx.el.append(...compact([heading, diagram, note]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
  }
  return {heading, note, diagram};
}

/** Height left for the diagram once the heading and note are placed. */
function diagramRoom(ctx: SceneContext, frame: Frame): number {
  const extra = (e: HTMLElement | null) => (e ? e.offsetHeight + 3 * ctx.u : 0);
  return (
    ctx.el.clientHeight -
    2 * ctx.safe -
    extra(frame.heading) -
    extra(frame.note)
  );
}

/** What the entrance and the per-frame drawing of a diagram need. */
interface Motion {
  frame: Frame;
  parts: Parts;
  lay: Layout;
  /** Index of the emphasised step, or -1. */
  active: number;
}

/** Adds the entrances and returns the function that draws the arrows. */
function animateFlow(ctx: SceneContext, m: Motion): SceneFrameFn {
  const {frame, parts, lay, active} = m;
  const {heading, note} = frame;
  const n = lay.n;
  const arrows = parts.connectors.map(c => buildArrow(ctx, c));
  const room = ctx.dur - 0.35 - 0.55 - 1.6;
  const ivl = ctx.clamp(room / (n - 1), 0.6, 1.0);
  const boxAt = (i: number) => 0.35 + i * ivl;
  const allDone = boxAt(n - 1) + 0.55;
  if (heading) {
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  parts.wraps.forEach((wrap, i) => {
    ctx.enter(wrap, boxAt(i), {y: lay.horizontal ? 2.4 : 2, dur: 0.55});
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
      drawArrow(a, p, lay.horizontal);
    });
    if (active >= 0) {
      paintActive(parts, active, ctx.ease.inOut(ctx.prog(t, accentAt, 0.6)));
    }
  };
}

registerScene('flow', (ctx, scene) => {
  const s = scene as FlowSceneSpec;
  const steps = parseSteps(s);
  const n = steps.length;
  const active = parseActive(s, n);
  const horizontal = ctx.aspect === 'landscape';
  const inline = !horizontal && ctx.aspect === 'square' && n >= 4;
  const lay: Layout = {horizontal, inline, n};
  const frame = buildFrame(ctx, s, lay);
  const parts = buildDiagram(ctx, steps, frame.diagram, lay);
  fitDiagram(lay, parts, frame.diagram, diagramRoom(ctx, frame));
  return animateFlow(ctx, {frame, parts, lay, active});
});
