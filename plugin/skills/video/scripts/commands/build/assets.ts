/**
 * @fileoverview Turns the files a film uses into `data:` URLs, so the built
 * page needs nothing next to it.
 */
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve, sep} from 'node:path';
import {UserError} from '../../core/errors.ts';
import {RUNTIME_DIR} from '../../core/paths.ts';
import type {FilmSpec} from '../../shared/contract.ts';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

const EXTERNAL = /^(https?:|data:|\/\/)/i;
const IMAGE = /\.(png|jpe?g|svg|webp|gif)$/i;

/** What {@link inlineSpecAssets} did. */
export interface InlineReport {
  /** The spec with files replaced by `data:` URLs. */
  spec: FilmSpec;
  /** Number of image references inlined. */
  images: number;
  /** Number of font files inlined. */
  fonts: number;
  /** References that point at files not found in the project folder. */
  missing: string[];
}

/** Reads a file and returns it as a `data:` URL. */
export function dataUrl(file: string): string {
  const mime = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

/**
 * Reads `reel.css` and replaces each font file it names with a `data:` URL.
 *
 * @throws UserError when a named font file is missing.
 */
export function inlinedCss(): string {
  const css = readFileSync(join(RUNTIME_DIR, 'reel.css'), 'utf8');
  return css.replace(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g, (_m, rel) => {
    const file = join(RUNTIME_DIR, rel as string);
    if (!existsSync(file)) {
      throw new UserError(
        `font file referenced by reel.css is missing: ${file}`,
      );
    }
    return `url("${dataUrl(file)}")`;
  });
}

function projectFile(dir: string, ref: string): string | null {
  const file = resolve(dir, ref.startsWith('/') ? `.${ref}` : ref);
  const inside = file === dir || file.startsWith(dir + sep);
  return inside && existsSync(file) && statSync(file).isFile() ? file : null;
}

/**
 * Replaces image paths anywhere in the spec, and `brand.fontFiles[].src`,
 * with `data:` URLs. The `customScenes` list is copied unchanged.
 *
 * @param dir Absolute project folder. Files outside it are never read.
 */
export function inlineSpecAssets(film: FilmSpec, dir: string): InlineReport {
  const report: InlineReport = {spec: film, images: 0, fonts: 0, missing: []};
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (!IMAGE.test(v) || EXTERNAL.test(v)) {
        return v;
      }
      const file = projectFile(dir, v);
      if (!file) {
        report.missing.push(v);
        return v;
      }
      report.images++;
      return dataUrl(file);
    }
    if (Array.isArray(v)) {
      return v.map(walk);
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v).map(([k, x]) => [
        k,
        k === 'customScenes' ? x : walk(x),
      ]);
      return Object.fromEntries(entries);
    }
    return v;
  };
  report.spec = walk(film) as FilmSpec;
  inlineFonts(report, dir);
  return report;
}

/** Replaces `brand.fontFiles[].src` paths with `data:` URLs. */
function inlineFonts(report: InlineReport, dir: string): void {
  for (const font of report.spec.brand?.fontFiles ?? []) {
    if (typeof font.src !== 'string' || EXTERNAL.test(font.src)) {
      continue;
    }
    const file = projectFile(dir, font.src);
    if (file && MIME[extname(file).toLowerCase()]) {
      font.src = dataUrl(file);
      report.fonts++;
    } else {
      report.missing.push(font.src);
    }
  }
}
