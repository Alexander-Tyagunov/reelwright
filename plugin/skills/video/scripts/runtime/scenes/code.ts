/**
 * code — a code card: monospace lines revealed line by line or typed, with diff and highlight rows.
 * { type:"code", duration, heading?, filename?,
 *   lines:[ "text" | { text, kind?: "add"|"remove"|"dim", highlight?: bool } ]   (1 to 14 lines; extra lines are ignored)
 *   reveal?: "lines"|"type"|"none"   (default "lines"; "type" types characters left to right, finishing 0.75 s before the end
 *                                     of the scene at the latest, so a long text types fast; "none" shows all at once)
 *   note? }                           (small line under the card)
 * add = green row with a "+" gutter, remove = red row with a "-" gutter, dim = faded row, highlight = accent bar that
 * fades in after the reveal. Lines starting with // or # are muted. Font size is fitted to the longest line (5u down
 * to 2.7u); below that the lines wrap.
 */

/** @fileoverview The `code` scene: a code card with typed or revealed rows. */

import type {SceneSpec} from '../../shared/contract.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import type {CodeLineKind, CodeRow, ParsedLine} from './lib/code-dom.ts';
import {buildCard, buildRow, fitSize} from './lib/code-dom.ts';
import type {RevealMode, RevealPlan, TypedLine} from './lib/code-typing.ts';
import {
  drawTyping,
  measureTyping,
  planReveal,
  prepareTyping,
} from './lib/code-typing.ts';
import {compact} from './lib/layout.ts';

/** One line of a `code` scene. */
export interface CodeLine {
  text: string;
  /** `add` is green with `+`, `remove` is red with `-`, `dim` is faded. */
  kind?: CodeLineKind;
  /** Draws an accent bar after the reveal. */
  highlight?: boolean;
}

/** Spec of a `code` scene. */
export interface CodeSceneSpec extends SceneSpec {
  type: 'code';
  heading?: string;
  /** Shown in a tab above the code. */
  filename?: string;
  /** 1 to 14 lines. A plain string is the text of a line. */
  lines: Array<string | CodeLine>;
  /** Default `lines`. */
  reveal?: RevealMode;
  /** Small line under the card. */
  note?: string;
}

function parseLines(s: CodeSceneSpec): ParsedLine[] {
  if (!Array.isArray(s.lines) || !s.lines.length) {
    throw new Error(
      'scene "code": field "lines" is required (a non-empty array of strings or {text, kind?, highlight?})',
    );
  }
  const kinds = ['add', 'remove', 'dim'];
  return s.lines.slice(0, 14).map((l, i) => {
    const o: Partial<CodeLine> = typeof l === 'string' ? {text: l} : l;
    if (!o || typeof o.text !== 'string') {
      throw new Error(`scene "code": lines[${i}] needs a string "text"`);
    }
    if (o.kind != null && !kinds.includes(o.kind)) {
      throw new Error(
        `scene "code": lines[${i}].kind must be "add", "remove" or "dim", got "${o.kind}"`,
      );
    }
    const text = o.text.replace(/\t/g, '  ').replace(/\s+$/, '');
    return {text, kind: o.kind, highlight: !!o.highlight};
  });
}

function parseReveal(s: CodeSceneSpec): RevealMode {
  const reveal = s.reveal || 'lines';
  if (!['lines', 'type', 'none'].includes(reveal)) {
    throw new Error(
      `scene "code": field "reveal" must be "lines", "type" or "none", got "${reveal}"`,
    );
  }
  return reveal;
}

/** Declares the entrances of the rows. Returns the typed lines, if any. */
function setupReveal(
  ctx: SceneContext,
  reveal: RevealMode,
  rows: readonly CodeRow[],
  plan: RevealPlan,
): TypedLine[] {
  if (reveal === 'lines') {
    rows.forEach((r, i) => {
      ctx.enter(r.row, plan.starts[i] ?? 0, {y: 1.2, dur: 0.5});
    });
  }
  if (reveal !== 'type') {
    return [];
  }
  const typed = rows.map((r, i) => {
    const start = plan.starts[i] ?? 0;
    return prepareTyping(ctx, r.code, r.line.text, start, plan.cps);
  });
  // Measure after every line is built, when the layout is final.
  typed.forEach(measureTyping);
  return typed;
}

/** Draws every row at scene-local time `t`. */
function drawRows(
  ctx: SceneContext,
  rows: readonly CodeRow[],
  typed: readonly TypedLine[],
  plan: RevealPlan,
  size: number,
  t: number,
): void {
  rows.forEach((r, i) => {
    let started = 1;
    const line = typed[i];
    if (line) {
      started = drawTyping(ctx, line, i, t, plan, size);
      if (r.gutter) {
        r.gutter.style.opacity = started.toFixed(3);
      }
    }
    if (r.tint) {
      const pct = (16 * started).toFixed(1);
      r.row.style.backgroundColor = `color-mix(in srgb, ${r.tint} ${pct}%, transparent)`;
    }
    if (r.bar) {
      const p = ctx.ease.out(ctx.prog(t, plan.revealEnd + 0.15, 0.5));
      r.bar.style.opacity = p.toFixed(3);
    }
  });
}

registerScene('code', (ctx, scene) => {
  const s = scene as CodeSceneSpec;
  const {el} = ctx;
  const reveal = parseReveal(s);
  const lines = parseLines(s);
  const hasMarks = lines.some(l => l.kind === 'add' || l.kind === 'remove');
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const parts = buildCard(ctx, s.filename);
  const note = s.note ? ctx.text('div', 'rw-small', s.note) : null;
  el.append(...compact([heading, parts.card, note]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
  }
  const rows = lines.map(line => {
    const r = buildRow(ctx, line, hasMarks);
    parts.body.append(r.row);
    return r;
  });
  const size = fitSize(ctx, parts, rows, {heading, note}, hasMarks);
  parts.body.style.fontSize = `${size.toFixed(2)}px`;
  const texts = lines.map(l => l.text);
  const plan = planReveal(ctx, reveal, texts, s.duration);
  const typed = setupReveal(ctx, reveal, rows, plan);
  if (heading) {
    ctx.enter(heading, 0.1, {y: 2.5});
  }
  ctx.enter(parts.card, 0.2, {y: 2.4, dur: 0.65});
  if (note) {
    ctx.enter(note, plan.revealEnd + 0.1, {y: 1.6});
  }
  return t => drawRows(ctx, rows, typed, plan, size, t);
});
