/**
 * @fileoverview Colour parsing and WCAG contrast. Colours are sRGB triples
 * with each channel from 0 to 255.
 */
import {CONTRAST_FAIL, CONTRAST_WARN} from './thresholds.ts';

/** Red, green and blue, each 0 to 255. */
export type Rgb = readonly [number, number, number];

/** How a contrast ratio is judged. */
export type ContrastLevel = 'FAIL' | 'WARN' | 'OK';

/**
 * Reads a CSS colour as sRGB. Understands `rgb()`, `rgba()`, `#rgb`,
 * `#rrggbb` and `color(srgb r g b)` with channels from 0 to 1. Alpha is
 * ignored.
 *
 * @returns The colour, or `null` for any other text.
 */
export function parseColor(text: string | undefined): Rgb | null {
  if (!text) {
    return null;
  }
  const rgb = text.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const full =
      hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
    const channel = (i: number) => Number.parseInt(full.slice(i, i + 2), 16);
    return [channel(0), channel(2), channel(4)];
  }
  const srgb = text.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgb) {
    return [
      Number(srgb[1]) * 255,
      Number(srgb[2]) * 255,
      Number(srgb[3]) * 255,
    ];
  }
  return null;
}

function linear(channel: number): number {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(color: Rgb): number {
  const [r, g, b] = color;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * WCAG contrast ratio of two colours.
 *
 * @returns A value from 1 (identical) to 21 (black on white), as `n`:1.
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Judges a contrast ratio: below 3:1 fails, below 4.5:1 warns.
 *
 * @param ratio Contrast as `n`:1.
 */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio < CONTRAST_FAIL) {
    return 'FAIL';
  }
  return ratio < CONTRAST_WARN ? 'WARN' : 'OK';
}
