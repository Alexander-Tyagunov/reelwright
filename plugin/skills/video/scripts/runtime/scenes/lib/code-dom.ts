/**
 * @fileoverview DOM of the `code` scene: the card, the rows and the font size
 * fit. Sizes are in pixels unless a name says `u` or `em`.
 */

import type {SceneContext} from '../../types.ts';
import {compact} from './layout.ts';

/** Row style of a code line. */
export type CodeLineKind = 'add' | 'remove' | 'dim';

/** A code line after validation. */
export interface ParsedLine {
  text: string;
  kind: CodeLineKind | undefined;
  highlight: boolean;
}

/** One row of the code card. */
export interface CodeRow {
  line: ParsedLine;
  row: HTMLElement;
  code: HTMLElement;
  /** Accent bar that fades in after the reveal. */
  bar: HTMLElement | null;
  /** Column with `+` or `-`. Present when any line is a diff line. */
  gutter: HTMLElement | null;
  /** CSS colour of the diff tint, if the row has one. */
  tint: string | null;
}

/** The card and its parts. */
export interface CodeCard {
  card: HTMLElement;
  tab: HTMLElement | null;
  body: HTMLElement;
}

/** Horizontal padding in `u`. */
export const PAD_X = 2.8;
/** Line height in `em`. */
export const LINE_HEIGHT = 1.5;
const MAX_SIZE = 5;
const MIN_SIZE = 2.4;

function tintOf(kind: CodeLineKind | undefined): string | null {
  if (kind === 'add') {
    return 'var(--good)';
  }
  return kind === 'remove' ? 'var(--bad)' : null;
}

function buildGutter(ctx: SceneContext, line: ParsedLine, tint: string | null) {
  const sign = line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : '';
  return ctx.h('div', {
    style: {
      width: '1.8em',
      flex: 'none',
      position: 'relative',
      fontWeight: '700',
      color: tint || 'var(--muted)',
    },
    text: sign,
  });
}

function buildBar(ctx: SceneContext) {
  return ctx.h('div', {
    style: {
      position: 'absolute',
      left: '0',
      top: '0',
      bottom: '0',
      width: 'calc(var(--u) * 0.6)',
      background: 'var(--accent)',
      opacity: '0',
    },
  });
}

/**
 * Builds one row.
 * @param ctx Scene context.
 * @param line The line.
 * @param hasMarks True when any line is a diff line, so rows get a gutter.
 */
export function buildRow(
  ctx: SceneContext,
  line: ParsedLine,
  hasMarks: boolean,
): CodeRow {
  const tint = tintOf(line.kind);
  const gutter = hasMarks ? buildGutter(ctx, line, tint) : null;
  const comment = /^\s*(\/\/|#)/.test(line.text);
  const code = ctx.text('div', 'rw-mono', line.text, {
    style: {
      flex: '1 1 0',
      minWidth: '0',
      whiteSpace: 'pre',
      position: 'relative',
      color: comment ? 'var(--muted)' : 'var(--ink)',
      opacity: line.kind === 'dim' ? '0.5' : '1',
      minHeight: `${LINE_HEIGHT}em`,
    },
  });
  const bar = line.highlight ? buildBar(ctx) : null;
  const row = ctx.h(
    'div',
    {
      style: {
        display: 'flex',
        position: 'relative',
        padding: `0 calc(var(--u) * ${PAD_X})`,
        minHeight: `${LINE_HEIGHT}em`,
      },
    },
    bar,
    gutter,
    code,
  );
  return {line, row, code, bar, gutter, tint};
}

function buildTab(ctx: SceneContext, filename: string) {
  const dot = ctx.h('div', {
    style: {
      width: 'calc(var(--u) * 1.2)',
      height: 'calc(var(--u) * 1.2)',
      borderRadius: '50%',
      background: 'var(--accent)',
      flex: 'none',
    },
  });
  const name = ctx.text('div', 'rw-mono rw-small', filename, {
    style: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: '0',
    },
  });
  return ctx.h(
    'div',
    {
      style: {
        padding: `calc(var(--u) * 1.5) calc(var(--u) * ${PAD_X})`,
        borderBottom: 'calc(var(--u) * 0.14) solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 'calc(var(--u) * 1.4)',
      },
    },
    dot,
    name,
  );
}

/**
 * Builds the card with its optional filename tab and an empty body.
 * @param ctx Scene context.
 * @param filename Text of the tab, or nothing for no tab.
 */
export function buildCard(
  ctx: SceneContext,
  filename: string | undefined,
): CodeCard {
  const card = ctx.h('div', {
    class: 'rw-card',
    style: {
      padding: '0',
      overflow: 'hidden',
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      flex: 'none',
    },
  });
  const tab = filename ? buildTab(ctx, filename) : null;
  const body = ctx.h('div', {
    class: 'rw-mono',
    style: {
      padding: 'calc(var(--u) * 2.2) 0',
      position: 'relative',
      fontSize: 'calc(var(--u) * 3.4)',
      lineHeight: String(LINE_HEIGHT),
    },
  });
  card.append(...compact([tab, body]));
  return {card, tab, body};
}

/** Space the scene needs around the code card. */
export interface Chrome {
  heading: HTMLElement | null;
  note: HTMLElement | null;
}

/**
 * Picks the largest font size that fits width and height. When even the
 * smallest size does not fit, the rows wrap.
 * @param ctx Scene context.
 * @param parts The card.
 * @param rows The rows.
 * @param chrome Heading and note, which take height.
 * @param hasMarks True when rows have a gutter.
 * @returns Font size in pixels.
 */
export function fitSize(
  ctx: SceneContext,
  parts: CodeCard,
  rows: readonly CodeRow[],
  chrome: Chrome,
  hasMarks: boolean,
): number {
  const {u} = ctx;
  const {card, tab, body} = parts;
  const probe = ctx.h('span', {
    style: {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre',
      fontSize: '100px',
    },
    text: 'M'.repeat(100),
  });
  body.append(probe);
  const ratio = probe.offsetWidth / 100 / 100 || 0.6;
  probe.remove();
  const maxCh = Math.max(...rows.map(r => r.line.text.length), 1);
  const byW =
    (card.clientWidth - 2 * PAD_X * u - 1) /
    ((hasMarks ? 1.8 : 0) + ratio * maxCh);
  const extra = (el: HTMLElement | null) => (el ? el.offsetHeight + 3 * u : 0);
  const reserved =
    (tab ? tab.offsetHeight : 0) +
    4.4 * u +
    extra(chrome.heading) +
    extra(chrome.note) +
    0.3 * u;
  const byH =
    (ctx.el.clientHeight - 2 * ctx.safe - reserved) /
    (rows.length * LINE_HEIGHT);
  const size = Math.min(MAX_SIZE * u, byW, byH);
  if (size >= MIN_SIZE * u) {
    return size;
  }
  for (const r of rows) {
    r.code.style.whiteSpace = 'pre-wrap';
    r.code.style.overflowWrap = 'anywhere';
  }
  return MIN_SIZE * u;
}
