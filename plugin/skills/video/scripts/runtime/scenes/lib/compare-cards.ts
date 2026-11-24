/**
 * @fileoverview Cards of the `compare` scene: building them and fitting them
 * into the frame. Sizes are in pixels unless a name says `u`.
 */

import type {SceneContext} from '../../types.ts';
import {clampText} from './layout.ts';

/** Tone of the left card. */
export type LeftTone = 'bad' | 'neutral';
/** Tone of the right card. */
export type RightTone = 'good' | 'accent';
/** Any card tone. */
export type Tone = LeftTone | RightTone;

/** One side after validation. */
export interface Side {
  title: string;
  items: string[];
  tone: Tone;
}

/** One built card. */
export interface Card {
  card: HTMLElement;
  title: HTMLElement;
  list: HTMLElement;
  items: Array<{row: HTMLElement; text: HTMLElement; full: string}>;
  titleFull: string;
}

type IconKind = 'x' | 'check' | 'dot';

/** Colour, icon and ink colour per tone. */
const TONES: Readonly<Record<Tone, readonly [string, IconKind, string]>> = {
  bad: ['var(--bad)', 'x', 'var(--bad-ink)'],
  neutral: ['var(--line-strong)', 'dot', 'var(--ink)'],
  good: ['var(--good)', 'check', 'var(--good-ink)'],
  accent: ['var(--accent)', 'check', 'var(--accent-ink)'],
};
const ITEM_SIZE = 4.2;
const TITLE_SIZE = 5.4;
/** Type scale and item lines per fitting attempt. */
const TRIES: ReadonlyArray<readonly [number, number]> = [
  [1.25, 3],
  [1.12, 3],
  [1, 3],
  [0.92, 3],
  [0.84, 2],
  [0.76, 2],
  [0.7, 2],
  [0.7, 1],
  [0.62, 1],
  [0.56, 1],
];

function icon(ctx: SceneContext, kind: IconKind): HTMLElement | SVGElement {
  const {h} = ctx;
  const props = {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 3.2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  const svgStyle = {width: '58%', height: '58%'};
  if (kind === 'x') {
    const path = h('path', {d: 'M7 7 L17 17 M17 7 L7 17', ...props});
    return h('svg', {viewBox: '0 0 24 24', style: svgStyle}, path);
  }
  if (kind === 'check') {
    const path = h('path', {d: 'M5.5 12.5 L10 17 L18.5 7.5', ...props});
    return h('svg', {viewBox: '0 0 24 24', style: svgStyle}, path);
  }
  return h('div', {
    style: {
      width: '30%',
      height: '30%',
      borderRadius: '50%',
      background: 'currentColor',
    },
  });
}

function buildItem(ctx: SceneContext, full: string, tone: Tone) {
  const {h} = ctx;
  const [color, kind, ink] = TONES[tone];
  const text = ctx.text('div', 'rw-body', full, {
    style: {
      fontSize: `calc(var(--u) * ${ITEM_SIZE})`,
      lineHeight: '1.25',
      fontWeight: '520',
    },
  });
  const badge = h(
    'div',
    {
      style: {
        width: 'calc(var(--u) * 4.4)',
        height: 'calc(var(--u) * 4.4)',
        borderRadius: '50%',
        background: color,
        color: ink,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 'calc(var(--u) * 0.3)',
      },
    },
    icon(ctx, kind),
  );
  const row = h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'calc(var(--u) * 2.2)',
      },
    },
    badge,
    h('div', {class: 'rw-grow'}, text),
  );
  return {row, text, full};
}

/**
 * Builds one card with its title and items.
 * @param ctx Scene context.
 * @param side The validated side.
 */
export function buildCard(ctx: SceneContext, side: Side): Card {
  const {h} = ctx;
  const color = TONES[side.tone][0];
  const title = ctx.text('h3', 'rw-h2', side.title, {
    style: {fontSize: `calc(var(--u) * ${TITLE_SIZE})`, margin: '0'},
  });
  const items = side.items.map(full => buildItem(ctx, full, side.tone));
  const list = h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 'calc(var(--u) * 2.6)',
        marginTop: 'calc(var(--u) * 3)',
      },
    },
    items.map(i => i.row),
  );
  const card = h(
    'div',
    {
      class: 'rw-card',
      style: {
        flex: '1 1 0',
        minWidth: '0',
        padding: 'calc(var(--u) * 4)',
        borderTop: `calc(var(--u) * 0.9) solid ${color}`,
      },
    },
    title,
    list,
  );
  return {card, title, list, items, titleFull: side.title};
}

/**
 * Shrinks, then cuts, the card text until the cards fit the frame.
 * @param cards The built cards.
 * @param wrap The element that holds the cards.
 * @param availH Gives the height available to `wrap`, in pixels.
 * @param u One unit in pixels.
 */
export function fitCards(
  cards: readonly Card[],
  wrap: HTMLElement,
  availH: () => number,
  u: number,
): void {
  for (const [k, lines] of TRIES) {
    const kk = Math.min(1, k);
    for (const c of cards) {
      c.card.style.padding = `${Math.max(2.2, 4 * kk) * u}px`;
      c.list.style.marginTop = `${Math.max(1.4, 3 * kk) * u}px`;
      c.list.style.gap = `${Math.max(1.2, 2.6 * kk) * u}px`;
      c.title.textContent = c.titleFull;
      c.title.style.fontSize = `${Math.max(3.6, TITLE_SIZE * k) * u}px`;
      for (const i of c.items) {
        i.text.textContent = i.full;
        i.text.style.fontSize = `${Math.max(3, ITEM_SIZE * k) * u}px`;
        clampText(i.text, lines);
      }
      clampText(c.title, 2);
    }
    if (wrap.offsetHeight <= availH() + 1) {
      break;
    }
  }
}
