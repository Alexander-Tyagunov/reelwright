/**
 * changelog — release-notes list: a tag chip, a title and an optional detail line per row.
 * { type:"changelog", duration, heading?, items:[{ tag, title, detail? }] }   (1 to 6 items)
 * tag "new" -> accent chip, "improved" -> neutral, "fixed" -> good; any other string -> neutral (shown uppercase).
 * Rows reveal one at a time, paced from the scene duration like bullets. Landscape with 5 or 6 items uses two
 * columns (read down the left column, then the right). Titles shrink, then detail lines are cut, if the list
 * would not fit the frame.
 */

/** @fileoverview The `changelog` scene: tagged release-note rows. */

import type {SceneSpec} from '../../shared/contract.ts';
import type {StyleObject} from '../dom.ts';
import {registerScene} from '../registry.ts';
import type {SceneContext} from '../types.ts';
import {
  clampText,
  compact,
  innerBox,
  makeFail,
  measureWidth,
} from './lib/layout.ts';

/** One row of a `changelog` scene. */
export interface ChangelogItem {
  /** Chip text: `new`, `improved`, `fixed` or any string. */
  tag: string;
  title: string;
  /** Optional second line. */
  detail?: string;
}

/** Spec of a `changelog` scene. */
export interface ChangelogSceneSpec extends SceneSpec {
  type: 'changelog';
  heading?: string;
  /** 1 to 6 rows. */
  items: ChangelogItem[];
}

interface Row {
  row: HTMLElement;
  chip: HTMLElement;
  title: HTMLElement;
  detail: HTMLElement | null;
  titleFull: string;
  detailFull: string;
}

const CHIP_TONES: Readonly<Record<string, string>> = {
  new: '',
  improved: 'neutral',
  fixed: 'good',
};
/** Title scale, title lines and detail lines per fitting attempt. */
const TRIES: ReadonlyArray<readonly [number, number, number]> = [
  [1.25, 2, 2],
  [1.12, 2, 2],
  [1, 2, 2],
  [0.92, 2, 2],
  [0.84, 2, 1],
  [0.78, 1, 1],
  [0.78, 1, 1],
];
const CHIP_STYLE: StyleObject = {
  fontSize: 'calc(var(--u) * 3)',
  padding: 'calc(var(--u) * 0.7) calc(var(--u) * 1.8)',
};

function chipClass(tag: string): string {
  const key = tag.toLowerCase();
  const tone = Object.hasOwn(CHIP_TONES, key) ? CHIP_TONES[key] : 'neutral';
  return `rw-chip ${tone}`;
}

function parseItems(s: ChangelogSceneSpec) {
  const fail = makeFail('changelog: ');
  if (!Array.isArray(s.items) || !s.items.length) {
    fail('"items" is required: an array of 1 to 6 {tag, title, detail?}');
  }
  if (s.items.length > 6) {
    fail(`"items" has ${s.items.length} entries; at most 6 fit`);
  }
  return s.items.map((it, i) => {
    if (!it || typeof it !== 'object') {
      fail(`items[${i}] must be an object {tag, title, detail?}`);
    }
    if (it.tag == null || String(it.tag).trim() === '') {
      fail(
        `items[${i}].tag is required ("new", "improved", "fixed" or any string)`,
      );
    }
    if (it.title == null || String(it.title).trim() === '') {
      fail(`items[${i}].title is required`);
    }
    const detail =
      it.detail == null || it.detail === '' ? '' : String(it.detail);
    return {tag: String(it.tag).trim(), title: String(it.title), detail};
  });
}

function listStyle(two: boolean, n: number): StyleObject {
  if (two) {
    return {
      display: 'grid',
      gridAutoFlow: 'column',
      gridTemplateRows: `repeat(${Math.ceil(n / 2)}, auto)`,
      gridTemplateColumns: '1fr 1fr',
      columnGap: 'calc(var(--u) * 6)',
      rowGap: 'calc(var(--u) * 3)',
      alignSelf: 'stretch',
      marginTop: 'calc(var(--u) * 1)',
    };
  }
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 'calc(var(--u) * 3)',
    alignSelf: 'stretch',
    maxWidth: 'calc(var(--u) * 135)',
    marginTop: 'calc(var(--u) * 1)',
  };
}

function fitRows(
  rows: readonly Row[],
  list: HTMLElement,
  availH: () => number,
  u: number,
): void {
  for (const [k, titleLines, detailLines] of TRIES) {
    for (const r of rows) {
      r.title.textContent = r.titleFull;
      r.title.style.fontSize = `${4.8 * k * u}px`;
      clampText(r.title, titleLines);
      if (r.detail) {
        r.detail.textContent = r.detailFull;
        clampText(r.detail, detailLines);
      }
    }
    if (list.offsetHeight <= availH() + 1) {
      break;
    }
  }
}

function buildRow(
  ctx: SceneContext,
  it: {tag: string; title: string; detail: string},
  chipW: number,
): Row {
  const chip = ctx.text('span', chipClass(it.tag), it.tag, {
    style: {
      width: `${chipW}px`,
      justifyContent: 'center',
      flex: 'none',
      marginTop: 'calc(var(--u) * 0.2)',
      ...CHIP_STYLE,
    },
  });
  const title = ctx.text('div', 'rw-h3', it.title);
  const detail = it.detail
    ? ctx.text('div', 'rw-small', it.detail, {
        style: {marginTop: 'calc(var(--u) * 0.5)'},
      })
    : null;
  const row = ctx.h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'calc(var(--u) * 2.4)',
        minWidth: '0',
      },
    },
    chip,
    ctx.h('div', {class: 'rw-grow'}, title, detail),
  );
  return {
    row,
    chip,
    title,
    detail,
    titleFull: it.title,
    detailFull: it.detail,
  };
}

registerScene('changelog', (ctx, scene) => {
  const s = scene as ChangelogSceneSpec;
  const {el, h, u} = ctx;
  const items = parseItems(s);
  const n = items.length;
  const widths = items.map(it =>
    measureWidth(el, it.tag, chipClass(it.tag), CHIP_STYLE),
  );
  const chipW = Math.ceil(Math.min(24 * u, Math.max(...widths)));
  const heading = s.heading ? ctx.text('h2', 'rw-h2', s.heading) : null;
  const two = ctx.aspect === 'landscape' && n >= 5;
  const list = h('div', {style: listStyle(two, n)});
  el.append(...compact([heading, list]));
  if (heading) {
    ctx.fit(heading, {maxLines: 2});
    ctx.enter(heading, 0.15, {y: 2.5});
  }
  const rows = items.map(it => {
    const built = buildRow(ctx, it, chipW);
    list.append(built.row);
    clampText(built.chip, 2);
    return built;
  });
  const availH = () =>
    innerBox(el).h - (heading ? heading.offsetHeight + 3 * u : 0);
  fitRows(rows, list, availH, u);
  const pace = ctx.clamp((s.duration - 2.6) / Math.max(1, n), 0.25, 0.9);
  rows.forEach((r, i) => {
    ctx.enter(r.row, 0.65 + i * pace, {y: 2.4, dur: 0.55});
  });
});
