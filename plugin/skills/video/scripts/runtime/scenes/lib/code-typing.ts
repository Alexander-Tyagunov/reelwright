/**
 * @fileoverview Reveal schedule and typing animation of the `code` scene.
 * Every value is a function of scene-local time `t`, in seconds.
 */

import type {SceneContext} from '../../types.ts';

/** How the lines of a code scene appear. */
export type RevealMode = 'lines' | 'type' | 'none';

/** When each line starts and how fast characters type. */
export interface RevealPlan {
  /** Start of every line, in scene-local seconds. Empty for `none`. */
  starts: number[];
  /** Typing speed in characters per second. 0 unless typing. */
  cps: number;
  /** Scene-local second at which the last line is on screen. */
  revealEnd: number;
}

/** DOM and measured positions of one typed line. */
export interface TypedLine {
  /** One span per character. */
  spans: HTMLElement[];
  caret: HTMLElement;
  /** Left and top of each character, in pixels. */
  pos: Array<[number, number]>;
  /** Left and top of the caret after the last character. */
  endPos: [number, number];
}

const START = 0.75;
const FADE_OUT = 0.45;
const MIN_HOLD = 0.3;

/**
 * Plans the reveal.
 * @param ctx Scene context, for `clamp`.
 * @param mode Reveal mode.
 * @param texts Text of each line.
 * @param duration Scene length in seconds.
 */
export function planReveal(
  ctx: SceneContext,
  mode: RevealMode,
  texts: readonly string[],
  duration: number,
): RevealPlan {
  const n = texts.length;
  if (mode === 'none') {
    return {starts: [], cps: 0, revealEnd: 0.5};
  }
  if (mode === 'lines') {
    const each = ctx.clamp((duration - START - 2.2) / n, 0.1, 0.32);
    const starts = texts.map((_, i) => START + i * each);
    return {starts, cps: 0, revealEnd: START + (n - 1) * each + 0.5};
  }
  const total = texts.reduce((a, text) => a + text.length, 0) || 1;
  const budget = Math.max(0.8, duration - START - 2.2 - 0.1 * n);
  let cps = ctx.clamp(total / budget, 25, 120);
  // Typing always ends before the fade-out and a short hold.
  const latest = duration - FADE_OUT - MIN_HOLD;
  const filled = texts.filter(text => text.length).length;
  cps = Math.max(cps, total / Math.max(0.2, latest - START - 0.1 * filled));
  const starts: number[] = [];
  let c = START;
  for (const text of texts) {
    starts.push(c);
    c += text.length ? text.length / cps + 0.1 : 0;
  }
  return {starts, cps, revealEnd: c};
}

/**
 * Splits a code element into character spans and adds a caret. Measure the
 * result with `measureTyping` once the layout is final.
 * @param ctx Scene context.
 * @param code The line element.
 * @param text The line text.
 * @param start Scene-local second at which the line starts, in seconds.
 * @param cps Typing speed in characters per second.
 */
export function prepareTyping(
  ctx: SceneContext,
  code: HTMLElement,
  text: string,
  start: number,
  cps: number,
): TypedLine {
  code.textContent = '';
  const spans = [...text].map(ch => {
    const span = ctx.h('span', {text: ch});
    code.append(span);
    return span;
  });
  // The reveal is a frame function, not a track, so say when it ends.
  ctx.settle(code, start + spans.length / cps);
  const caret = ctx.h('div', {
    style: {
      position: 'absolute',
      width: 'calc(var(--u) * 0.45)',
      height: '1.2em',
      background: 'var(--accent)',
      opacity: '0',
      left: '0',
      top: '0',
    },
  });
  code.append(caret);
  return {spans, caret, pos: [], endPos: [0, 0]};
}

/** Measures character positions. Call after the layout is final. */
export function measureTyping(line: TypedLine): void {
  line.pos = line.spans.map(c => [c.offsetLeft, c.offsetTop]);
  const last = line.spans[line.spans.length - 1];
  line.endPos = last
    ? [last.offsetLeft + last.offsetWidth, last.offsetTop]
    : [0, 0];
}

/**
 * Draws one typed line at time `t`: character opacity and caret.
 * @param ctx Scene context.
 * @param line The typed line.
 * @param i Index of the line.
 * @param t Scene-local time in seconds.
 * @param plan The reveal plan.
 * @param size Code font size in pixels.
 * @returns Progress of the line start, 0 to 1. Drives the row tint.
 */
export function drawTyping(
  ctx: SceneContext,
  line: TypedLine,
  i: number,
  t: number,
  plan: RevealPlan,
  size: number,
): number {
  const {starts, cps} = plan;
  const start = starts[i] ?? 0;
  const len = line.spans.length;
  const k = len ? Math.floor(ctx.clamp((t - start) * cps, 0, len)) : 0;
  line.spans.forEach((span, j) => {
    const v = j < k ? '1' : '0';
    if (span.style.opacity !== v) {
      span.style.opacity = v;
    }
  });
  const started = len
    ? ctx.ease.out(ctx.prog(t, start, 0.25))
    : t >= start
      ? 1
      : 0;
  const nextStart = starts.slice(i + 1).find(x => x > start);
  const end = start + len / cps;
  const active =
    len && t >= start && (nextStart != null ? t < nextStart : t < end + 0.3);
  if (active) {
    const p = k < len ? (line.pos[k] ?? line.endPos) : line.endPos;
    line.caret.style.left = `${p[0]}px`;
    line.caret.style.top = `${(p[1] + 0.12 * size).toFixed(1)}px`;
    const fade = k >= len ? 1 - ctx.ease.out(ctx.prog(t, end, 0.3)) : 1;
    line.caret.style.opacity = String(fade);
  } else {
    line.caret.style.opacity = '0';
  }
  return started;
}
