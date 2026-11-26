/**
 * @fileoverview Names of the files a film spec writes. Every output carries
 * the spec's base name, so two specs in one folder never touch each other's
 * files. A spec called `film.json` keeps the short names.
 */
import {basename, dirname, extname, join} from 'node:path';

/** Base name of the spec that keeps the unprefixed output names. */
const DEFAULT_STEM = 'film';

/** The output paths of one spec. Every path is absolute. */
export interface Outputs {
  /** Spec file name without its extension, such as `film-desk`. */
  stem: string;
  /** The `out` folder next to the spec. */
  dir: string;
  /** Rendered video: `<stem>[suffix].mp4`. */
  video(suffix?: string): string;
  /** Render summary: `render[suffix].json`, prefixed for other specs. */
  summary(suffix?: string): string;
  /** QA report: `qa-report[suffix].json`, prefixed for other specs. */
  report(suffix?: string): string;
  /** Sound file or cue list: `sound[suffix].wav` or `.json`. */
  sound(ext: 'wav' | 'json', suffix?: string): string;
  /** Hidden scratch file of the sound loudness fit. */
  soundScratch(suffix?: string): string;
  /** Folder of stills: `stills` or `strip`, plus the suffix. */
  stills(kind: 'stills' | 'strip', suffix?: string): string;
  /** Contact sheet of the stills: `contact` or `strip`, plus the suffix. */
  sheet(kind: 'stills' | 'strip', suffix?: string): string;
  /** Folder of delivery files made by `export`. */
  exports(): string;
  /** Folder of cached scene segments. Hidden. */
  segments(): string;
  /** Single-file HTML bundle: `<stem>.html`. */
  html(): string;
}

/** Returns the base name of a spec path without folder or extension. */
export function specStem(specPath: string): string {
  return basename(specPath, extname(specPath));
}

/**
 * Builds the output names of a spec.
 *
 * @param specPath Path of the spec file; only its base name is used.
 * @param specDir Folder of the spec. Outputs go to its `out` subfolder.
 */
export function outputsOf(specPath: string, specDir: string): Outputs {
  const stem = specStem(specPath);
  const dir = join(specDir, 'out');
  const own = stem === DEFAULT_STEM ? '' : `${stem}.`;
  const named = (base: string, ext: string, suffix = ''): string =>
    join(dir, `${own}${base}${suffix}${ext}`);
  return {
    stem,
    dir,
    video: (suffix = '') => join(dir, `${stem}${suffix}.mp4`),
    summary: suffix => named('render', '.json', suffix),
    report: suffix => named('qa-report', '.json', suffix),
    sound: (ext, suffix) => named('sound', `.${ext}`, suffix),
    soundScratch: suffix =>
      join(dir, `.${own}sound-measure${suffix ?? ''}.wav`),
    stills: (kind, suffix) => named(kind, '', suffix),
    sheet: (kind, suffix) =>
      named(kind === 'strip' ? 'strip' : 'contact', '.jpg', suffix),
    exports: () => named('export', ''),
    segments: () => join(dir, `.${own}segments`),
    html: () => join(dir, `${stem}.html`),
  };
}

/**
 * Finds the render summary that belongs to a video of a spec.
 *
 * @param video Path of a video named `<stem>[suffix].mp4`.
 * @param stem Base name of the spec that made it.
 * @returns The summary path, or null when the video is not named after the
 *   spec.
 */
export function summaryPathFor(video: string, stem: string): string | null {
  const name = basename(video, extname(video));
  if (!name.startsWith(stem)) {
    return null;
  }
  const own = stem === DEFAULT_STEM ? '' : `${stem}.`;
  return join(dirname(video), `${own}render${name.slice(stem.length)}.json`);
}
