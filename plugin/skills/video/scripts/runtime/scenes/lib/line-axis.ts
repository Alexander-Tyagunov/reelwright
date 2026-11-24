/**
 * @fileoverview Pure axis maths of the `line-chart` scene: nice tick steps,
 * decimals and the choice of x labels. No DOM access.
 */

/** A y axis: its range and tick values, in data units. */
export interface Axis {
  lo: number;
  hi: number;
  step: number;
  ticks: number[];
}

interface Candidate extends Axis {
  first: number;
  count: number;
  score: number;
}

const STEP_MULTIPLES = [1, 2, 2.5, 5];
/** Number of ticks the axis aims for. */
const TARGET_TICKS = 3.5;
const EPSILON = 1e-9;

/**
 * Picks a tick step that gives about three to four gridlines.
 * @param dmin Smallest data value.
 * @param dmax Largest data value, larger than `dmin`.
 * @param yMin Fixed lower end of the axis, if the spec sets one.
 * @param yMax Fixed upper end of the axis, if the spec sets one.
 */
export function computeAxis(
  dmin: number,
  dmax: number,
  yMin?: number,
  yMax?: number,
): Axis {
  let best: Candidate | null = null;
  const e0 = Math.floor(Math.log10(dmax - dmin));
  for (let k = e0 - 2; k <= e0 + 1; k++) {
    for (const m of STEP_MULTIPLES) {
      const step = m * 10 ** k;
      const lo = yMin ?? Math.floor(dmin / step + EPSILON) * step;
      const hi = yMax ?? Math.ceil(dmax / step - EPSILON) * step;
      const first = Math.ceil(lo / step - EPSILON) * step;
      const count = Math.floor((hi - first) / step + EPSILON) + 1;
      const score = Math.abs(count - TARGET_TICKS) * 1000 + (hi - lo) / step;
      if (count >= 2 && (!best || score < best.score)) {
        best = {step, lo, hi, first, count, score, ticks: []};
      }
    }
  }
  if (!best) {
    return {lo: dmin, hi: dmax, step: dmax - dmin, ticks: [dmin, dmax]};
  }
  const {first, step, count, lo, hi} = best;
  const ticks = Array.from({length: count}, (_, i) => first + i * step);
  return {lo, hi, step, ticks};
}

/**
 * Smallest number of decimals (0 to 2) that shows `v` exactly.
 * @param v A value in data units.
 */
export function decimalsOf(v: number): number {
  for (let d = 0; d < 3; d++) {
    const scaled = v * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) {
      return d;
    }
  }
  return 2;
}

/**
 * Chooses which x labels to show: the first, the last and evenly spaced ones
 * that do not touch.
 * @param nPts Number of points on the x axis.
 * @param xAt Maps a point index to its x position, in pixels.
 * @param widths Label width per point, in pixels.
 * @param gap Smallest free space between two labels, in pixels.
 * @returns Point indices, in increasing order.
 */
export function pickXLabels(
  nPts: number,
  xAt: (i: number) => number,
  widths: readonly number[],
  gap: number,
): number[] {
  const found: Array<{m: number; idx: number[]; even: boolean}> = [];
  for (let m = Math.min(nPts, 7); m >= 2; m--) {
    const idx = Array.from({length: m}, (_, i) =>
      Math.round((i * (nPts - 1)) / (m - 1)),
    );
    const apart = idx.every((p, k) => {
      const prev = idx[k - 1];
      if (k === 0 || prev === undefined) {
        return true;
      }
      const need = ((widths[p] ?? 0) + (widths[prev] ?? 0)) / 2 + gap;
      return xAt(p) - xAt(prev) >= need;
    });
    if (idx.length === new Set(idx).size && apart) {
      found.push({m, idx, even: (nPts - 1) % (m - 1) === 0});
    }
  }
  // Prefer evenly spaced picks.
  const best = found.find(f => f.even && f.m <= 6) ?? found[0];
  return best ? best.idx : [0, nPts - 1];
}
