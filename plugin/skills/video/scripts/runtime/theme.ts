/**
 * @fileoverview Colour palettes, brand resolution and the CSS variables of the
 * stage. Colours reach scenes only through these variables.
 */

import type {Brand} from '../shared/contract.ts';
import type {ResolvedBrand, ResolvedMeta} from './types.ts';

/** The colour fields of a palette. Values are CSS colours. */
export type Palette = Required<
  Pick<
    Brand,
    | 'bg'
    | 'surface'
    | 'ink'
    | 'muted'
    | 'accent'
    | 'accentInk'
    | 'good'
    | 'goodInk'
    | 'bad'
    | 'badInk'
    | 'line'
    | 'lineStrong'
  >
>;

/** Built-in palettes by theme name. */
export const THEMES: Readonly<Record<'dark' | 'light', Palette>> = {
  dark: {
    bg: '#0F1115',
    surface: '#191C23',
    ink: '#F3F0EA',
    muted: '#9BA2AE',
    accent: '#E8613C',
    accentInk: '#14100E',
    good: '#3CC08A',
    goodInk: '#08130E',
    bad: '#EF5F57',
    badInk: '#170807',
    line: 'rgba(255,255,255,0.10)',
    lineStrong: 'rgba(255,255,255,0.18)',
  },
  light: {
    bg: '#FAF8F4',
    surface: '#FFFFFF',
    ink: '#15171C',
    muted: '#5D6470',
    accent: '#C2411C',
    accentInk: '#FFFFFF',
    good: '#12805A',
    goodInk: '#FFFFFF',
    bad: '#C8372F',
    badInk: '#FFFFFF',
    line: 'rgba(15,17,21,0.10)',
    lineStrong: 'rgba(15,17,21,0.18)',
  },
};

const COLOR_KEYS = Object.keys(THEMES.dark) as Array<keyof Palette>;
const DEFAULT_RADIUS = 2.2;

/**
 * Merges the theme palette with the colour overrides of a brand and fills in
 * the font and radius defaults.
 * @param brand The `brand` block of the spec. May be missing.
 */
export function resolveBrand(brand: Brand = {}): ResolvedBrand {
  const palette = {...(THEMES[brand.theme ?? 'dark'] ?? THEMES.dark)};
  for (const key of COLOR_KEYS) {
    const value = brand[key];
    if (value !== undefined) {
      palette[key] = value;
    }
  }
  const font = brand.font || 'Inter';
  return {
    ...palette,
    font,
    fontDisplay: brand.fontDisplay || font,
    fontMono: brand.fontMono || 'JetBrains Mono',
    radius: brand.radius ?? DEFAULT_RADIUS,
  };
}

const MONO_FALLBACK = '"JetBrains Mono", ui-monospace, monospace';

/**
 * Writes the stage CSS variables: `--u`, `--safe`, the colours, `--radius`
 * and the three font stacks.
 * @param stage The stage element.
 * @param brand A resolved brand.
 * @param meta Resolved meta: `safe` is in `u`.
 * @param u One unit in pixels (1% of the short side).
 */
export function applyCssVariables(
  stage: HTMLElement,
  brand: ResolvedBrand,
  meta: ResolvedMeta,
  u: number,
): void {
  const vars: Record<string, string | number> = {
    '--u': `${u}px`,
    '--safe': meta.safe,
    '--bg': brand.bg,
    '--surface': brand.surface,
    '--ink': brand.ink,
    '--muted': brand.muted,
    '--accent': brand.accent,
    '--accent-ink': brand.accentInk,
    '--good': brand.good,
    '--good-ink': brand.goodInk,
    '--bad': brand.bad,
    '--bad-ink': brand.badInk,
    '--line': brand.line,
    '--line-strong': brand.lineStrong,
    '--radius': brand.radius,
    '--font': `"${brand.font}", "Inter", system-ui, sans-serif`,
    '--font-display': `"${brand.fontDisplay}", "Inter", system-ui, sans-serif`,
    '--font-mono': `"${brand.fontMono}", ${MONO_FALLBACK}`,
  };
  for (const [name, value] of Object.entries(vars)) {
    stage.style.setProperty(name, String(value));
  }
}
