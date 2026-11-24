/**
 * @fileoverview Font loading. Text is measured while scenes build, so every
 * face must be ready before the first scene is created.
 */

import type {FontFile} from '../shared/contract.ts';
import {recordError} from './errors.ts';
import type {ResolvedBrand} from './types.ts';

const WEIGHTS = [400, 700];

async function loadFontFile(file: FontFile): Promise<void> {
  try {
    const face = new FontFace(file.family, `url("${file.src}")`, {
      weight: String(file.weight || '100 900'),
      style: file.style || 'normal',
    });
    await face.load();
    document.fonts.add(face);
  } catch {
    recordError(`font file failed to load: ${file.src}`);
  }
}

/**
 * Loads the project font files, then waits for the brand families.
 * @param brand Resolved brand: its three font families are waited for.
 * @param files Font files from `brand.fontFiles`, with paths the page can
 *   fetch.
 * @returns Families that are still missing after loading.
 */
export async function loadFonts(
  brand: ResolvedBrand,
  files: readonly FontFile[] = [],
): Promise<string[]> {
  for (const file of files) {
    await loadFontFile(file);
  }
  const families = [
    ...new Set([brand.font, brand.fontDisplay, brand.fontMono]),
  ];
  const loads = families.flatMap(family =>
    WEIGHTS.map(weight =>
      document.fonts.load(`${weight} 20px "${family}"`).catch(() => null),
    ),
  );
  await Promise.all(loads);
  await document.fonts.ready;
  return families.filter(
    family => !document.fonts.check(`400 20px "${family}"`),
  );
}
