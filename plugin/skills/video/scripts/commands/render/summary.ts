/**
 * @fileoverview Writes and prints the summary of a finished render.
 */
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {OpenFilm} from '../../browser/film.ts';
import {specHash} from '../../core/stamp.ts';
import type {RenderSettings, Segment} from './plan.ts';
import {outputSize} from './plan.ts';

/** Everything {@link writeSummary} reports. */
export interface SummaryInput {
  film: OpenFilm;
  settings: RenderSettings;
  /** Absolute path of the MP4. */
  out: string;
  /** File name suffix such as `-1080x1920-draft`. */
  suffix: string;
  /** Total frames written. */
  frames: number;
  segments: Segment[];
  /** Segments drawn in this run. */
  todo: Segment[];
  /** Start of the run, in milliseconds since the Unix epoch. */
  started: number;
}

/**
 * Writes `out/render[suffix].json` and prints the result. The JSON holds the
 * spec hash that `qa` compares to find a stale video.
 */
export function writeSummary(input: SummaryInput): void {
  const {film, settings, out, suffix, frames, segments, todo} = input;
  const {spec} = film;
  const size = outputSize(settings);
  const seconds = Number(((Date.now() - input.started) / 1000).toFixed(1));
  const summary = {
    file: out,
    ...size,
    fps: settings.fps,
    frames,
    duration: Number((frames / settings.fps).toFixed(3)),
    specHash: specHash(spec.abs, spec.dir, spec.film),
    scenes: segments.length,
    rendered: todo.length,
    reused: segments.length - todo.length,
    seconds,
    draft: settings.draft,
  };
  const name = join(spec.dir, 'out', `render${suffix}.json`);
  writeFileSync(name, JSON.stringify(summary, null, 2));
  console.log(`rendered ${summary.file}`);
  console.log(
    `  ${size.width}x${size.height} ${settings.fps} fps, ${frames} frames, ` +
      `${summary.duration}s; ${summary.rendered} scenes rendered, ` +
      `${summary.reused} reused, ${seconds}s wall time`,
  );
  const missing = film.info.missingFonts;
  if (missing.length) {
    console.log(
      `warning: fonts not available, a fallback was drawn: ${missing.join(', ')}`,
    );
  }
}
