/**
 * @fileoverview Number formatting for counters and chart labels.
 */

/** Options for `formatNumber`. */
export interface FormatOptions {
  /** Digits after the decimal point. Ignored when compact. Default 0. */
  decimals?: number;
  /** Text put before the number, for example `"$"`. */
  prefix?: string;
  /** Text put after the number, for example `"%"`. */
  suffix?: string;
  /** Shortens thousands, millions and billions to `k`, `M` and `B`. */
  compact?: boolean;
}

const UNITS: ReadonlyArray<readonly [number, string]> = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
];

function compactText(v: number): string {
  const [divisor, letter] = UNITS.find(([d]) => Math.abs(v) >= d) ??
    UNITS[2] ?? [1, ''];
  const scaled = v / divisor;
  const digits = Math.abs(scaled) >= 100 ? 0 : 1;
  return scaled.toFixed(digits).replace(/\.0$/, '') + letter;
}

/**
 * Formats a number with thousands separators.
 * @param v The value. A negative value gets a true minus sign (U+2212).
 * @param options Decimals, prefix, suffix and compact mode.
 */
export function formatNumber(v: number, options: FormatOptions = {}): string {
  const {decimals = 0, prefix = '', suffix = '', compact = false} = options;
  let s: string;
  if (compact && Math.abs(v) >= 1000) {
    s = compactText(v);
  } else {
    s = Math.abs(v)
      .toFixed(decimals)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (v < 0) {
      s = `−${s}`;
    }
  }
  return prefix + s + suffix;
}
