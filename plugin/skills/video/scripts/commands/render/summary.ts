/**
 * @fileoverview Writes and prints the summary of a finished render.
 */
import {writeFileSync} from 'node:fs';
import type {OpenFilm} from '../../browser/film.ts';
import {outputsOf} from '../../core/outputs.ts';
import {specHash} from '../../core/stamp.ts';
import type {Soundtrack} from '../../video/soundtrack.ts';
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
  /** The soundtrack added to the file, or null for a silent film. */
  sound: Soundtrack | null;
}

function finite(v: number): number | null {
  return Number.isFinite(v) ? Number(v.toFixed(1)) : null;
}

function soundFacts(sound: Soundtrack | null) {
  if (!sound) {
    return null;
  }
  return {
    file: sound.file,
    palette: sound.palette,
    cues: sound.cues.length,
    lufs: finite(sound.loudness.lufs),
    truePeak: finite(sound.loudness.truePeak),
  };
}

function printSound(sound: ReturnType<typeof soundFacts>): void {
  if (!sound) {
    console.log('  sound: none (silent film)');
    return;
  }
  const {palette, cues, lufs, truePeak} = sound;
  console.log(
    `  sound: palette ${palette}, ${cues} cues, ${lufs} LUFS, ` +
      `true peak ${truePeak} dBTP`,
  );
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
    sound: soundFacts(input.sound),
  };
  const name = outputsOf(spec.abs, spec.dir).summary(suffix);
  writeFileSync(name, JSON.stringify(summary, null, 2));
  console.log(`rendered ${summary.file}`);
  console.log(
    `  ${size.width}x${size.height} ${settings.fps} fps, ${frames} frames, ` +
      `${summary.duration}s; ${summary.rendered} scenes rendered, ` +
      `${summary.reused} reused, ${seconds}s wall time`,
  );
  for (const w of film.info.warnings) {
    console.log(`warning: ${w}`);
  }
  printSound(summary.sound);
  const missing = film.info.missingFonts;
  if (missing.length) {
    console.log(
      'warning: fonts not available, a fallback was drawn: ' +
        missing.join(', '),
    );
  }
}
