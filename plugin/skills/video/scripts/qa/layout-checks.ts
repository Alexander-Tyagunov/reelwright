/**
 * @fileoverview Pure checks of text boxes in one drawn frame: safe area,
 * clipping, placeholder words, type size, contrast and overlap. Pixels
 * unless stated.
 */
import type {LayoutItem} from '../shared/contract.ts';
import {contrastLevel, contrastRatio, parseColor} from './contrast.ts';
import {quoted, r2} from './labels.ts';
import {
  CONTRAST_FAIL,
  CONTRAST_WARN,
  MIN_FONT_FRACTION,
  OVERLAP_FRACTION,
  SAFE_TOLERANCE_PX,
} from './thresholds.ts';

/** One problem found. `key` is the same for the same problem at any time. */
export interface Finding {
  status: 'FAIL' | 'WARN';
  key: string;
  message: string;
}

/** Where and when a text was measured. */
export interface Spot {
  /** Frame width in pixels. */
  width: number;
  height: number;
  /** Safe margin in pixels. */
  safe: number;
  /** Film time of the frame in seconds. */
  t: number;
  /** Zero-based scene index of the frame being checked. */
  scene: number;
  /** Type of that scene. Code scenes may show `null` as code. */
  type?: string;
}

/** What {@link measureItem} found out about one text. */
export interface ItemMeasure {
  findings: Finding[];
  /** Largest overshoot past the safe area, in pixels. Negative when inside. */
  overflow: number;
  /** Font size divided by the short side of the frame. */
  fontFraction: number;
  /** Contrast as `n`:1, or null when a colour could not be read. */
  contrast: number | null;
}

function scopeOf(item: LayoutItem, spot: Spot): string {
  return item.scene === -1 ? `ov:${item.id}` : `${spot.scene}:${item.id}`;
}

function edgeFindings(item: LayoutItem, spot: Spot, label: string) {
  const {x, y, w, h} = item;
  const edges: ReadonlyArray<[string, number]> = [
    ['left', spot.safe - x],
    ['top', spot.safe - y],
    ['right', x + w - (spot.width - spot.safe)],
    ['bottom', y + h - (spot.height - spot.safe)],
  ];
  const out: Finding[] = [];
  for (const [edge, over] of edges) {
    if (over > SAFE_TOLERANCE_PX) {
      out.push({
        status: 'FAIL',
        key: `${scopeOf(item, spot)}:safe${edge}`,
        message:
          `${label} ${quoted(item.text)}: ${r2(over)} px outside the safe ` +
          `area at the ${edge} edge (safe margin ${r2(spot.safe)} px; box ` +
          `x=${x} y=${y} w=${w} h=${h} in a ${spot.width}x${spot.height} ` +
          `frame, at t=${spot.t}s)`,
      });
    }
  }
  return {out, overflow: Math.max(...edges.map(e => e[1]))};
}

function clipFinding(
  item: LayoutItem,
  scope: string,
  label: string,
): Finding[] {
  if (!item.clipped) {
    return [];
  }
  return [
    {
      status: 'FAIL',
      key: `${scope}:clip`,
      message:
        `${label} ${quoted(item.text)}: text is clipped by its box (content ` +
        'larger than the element; shorten the text, widen the box or call ' +
        'ctx.fit)',
    },
  ];
}

function fontFinding(
  item: LayoutItem,
  scope: string,
  label: string,
  short: number,
): Finding[] {
  const fraction = item.fontSize / short;
  if (fraction >= MIN_FONT_FRACTION) {
    return [];
  }
  return [
    {
      status: 'WARN',
      key: `${scope}:font`,
      message:
        `${label} ${quoted(item.text)}: font size ${r2(item.fontSize)} px ` +
        `is ${r2(fraction * 100)}% of the short side, need at least ` +
        `${MIN_FONT_FRACTION * 100}% (${r2(MIN_FONT_FRACTION * short)} px)`,
    },
  ];
}

const PLACEHOLDER =
  /(?<![\w$.])(NaN|undefined|null)(?![\w$])|\[object Object\]/;

function placeholderFinding(
  item: LayoutItem,
  spot: Spot,
  scope: string,
  label: string,
): Finding[] {
  const found = PLACEHOLDER.exec(item.text);
  const token = found?.[0];
  if (!token || (spot.type === 'code' && token !== 'NaN')) {
    return [];
  }
  return [
    {
      status: 'FAIL',
      key: `${scope}:placeholder`,
      message:
        `${label} ${quoted(item.text)}: the text shows "${token}", which ` +
        'means a value is missing or not a number (check the scene fields ' +
        'for a misspelt name or a wrong type)',
    },
  ];
}

function contrastFinding(
  item: LayoutItem,
  scope: string,
  label: string,
  ratio: number | null,
): Finding[] {
  const level = ratio === null ? 'OK' : contrastLevel(ratio);
  if (ratio === null || level === 'OK') {
    return [];
  }
  const need = level === 'FAIL' ? CONTRAST_FAIL : CONTRAST_WARN;
  return [
    {
      status: level,
      key: `${scope}:contrast`,
      message:
        `${label} ${quoted(item.text)}: contrast ${r2(ratio)}:1 (text ` +
        `${item.color} on ${item.bg}), need at least ${need}:1`,
    },
  ];
}

/**
 * Measures one text box against the safe area, its own box, the words that
 * mean a missing value (`NaN`, `undefined`, `null`, `[object Object]`), the
 * minimum type size and the contrast limits.
 *
 * @param label Name of the scene or overlay for messages.
 */
export function measureItem(
  item: LayoutItem,
  spot: Spot,
  label: string,
): ItemMeasure {
  const scope = scopeOf(item, spot);
  const short = Math.min(spot.width, spot.height);
  const edges = edgeFindings(item, spot, label);
  const fg = parseColor(item.color);
  const bg = parseColor(item.bg);
  const contrast = fg && bg ? contrastRatio(fg, bg) : null;
  return {
    findings: [
      ...edges.out,
      ...clipFinding(item, scope, label),
      ...placeholderFinding(item, spot, scope, label),
      ...fontFinding(item, scope, label, short),
      ...contrastFinding(item, scope, label, contrast),
    ],
    overflow: edges.overflow,
    fontFraction: item.fontSize / short,
    contrast,
  };
}

function isRelated(
  a: LayoutItem,
  b: LayoutItem,
  parents: Map<number, number | null>,
) {
  const climbs = (from: LayoutItem, target: LayoutItem): boolean => {
    for (let n = parents.get(from.id); n != null; n = parents.get(n)) {
      if (n === target.id) {
        return true;
      }
    }
    return false;
  };
  return climbs(a, b) || climbs(b, a);
}

/**
 * Finds pairs of unrelated texts whose boxes share more than 4% of the
 * smaller box. A text and its parent or child are related and never count.
 *
 * @param items Items of one frame.
 * @param label Name of the scene for messages.
 */
export function findOverlaps(
  items: readonly LayoutItem[],
  spot: Spot,
  label: string,
): Finding[] {
  const parents = new Map(items.map(i => [i.id, i.parent]));
  const out: Finding[] = [];
  for (const [i, a] of items.entries()) {
    for (const b of items.slice(i + 1)) {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const small = Math.min(a.w * a.h, b.w * b.h);
      if (w <= 0 || h <= 0 || small <= 0 || isRelated(a, b, parents)) {
        continue;
      }
      const share = (w * h) / small;
      if (share > OVERLAP_FRACTION) {
        out.push({
          status: 'FAIL',
          key: `ovl:${spot.scene}:${a.id}:${b.id}`,
          message:
            `${label}: ${quoted(a.text)} overlaps ${quoted(b.text)} by ` +
            `${r2(share * 100)}% of the smaller box (${r2(w)}x${r2(h)} px; ` +
            `limit ${OVERLAP_FRACTION * 100}%; at t=${spot.t}s)`,
        });
      }
    }
  }
  return out;
}
