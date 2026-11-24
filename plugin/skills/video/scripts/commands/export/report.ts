/**
 * @fileoverview Prints the result of one export and records it in
 * `export.json`.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import type {Loudness} from '../../video/loudness.ts';
import {LOUDNESS_TARGET} from '../../video/loudness.ts';
import type {MediaFacts, VideoFacts} from '../../video/probe.ts';
import type {Preset} from './presets.ts';

/** A poster image made from the master. */
export interface Poster {
  file: string;
  /** Time of the frame in seconds. */
  time: number;
  sizeBytes: number;
}

/** One finished export. */
export interface ExportResult {
  name: string;
  preset: Preset;
  out: string;
  master: string;
  /** Facts about the output file. */
  facts: MediaFacts & {video: VideoFacts};
  loudness: Loudness | null;
  poster: Poster | null;
  warnings: string[];
  /** The command that made the file, as one line. */
  command: string;
  /** Extra line for the report, or an empty string. */
  note: string;
}

/** Formats bytes as megabytes with two decimals. */
export function megabytes(bytes: number): string {
  return (bytes / 1048576).toFixed(2);
}

function describeVideo(v: VideoFacts): string {
  return v.gif
    ? 'gif'
    : `${v.codec}${v.profile ? ` ${v.profile}` : ''} ${v.pixFmt}`;
}

function describeAudio(facts: MediaFacts): string {
  const a = facts.audio;
  if (!a) {
    return ', no audio';
  }
  const channels = a.channels === 2 ? 'stereo' : `${a.channels} ch`;
  return ` + ${a.codec} ${a.sampleRate} Hz ${channels}`;
}

/** Prints the report for one export. */
export function printResult(r: ExportResult): void {
  const {video: v} = r.facts;
  const copied = !v.gif && r.command.includes('-c:v copy');
  const stream = copied ? ' (video stream copied, not re-encoded)' : '';
  console.log(`${r.name}: ${r.out}`);
  console.log(
    `  ${megabytes(r.facts.size)} MB  ${v.width}x${v.height}  ${v.fps} fps  ` +
      `${r.facts.duration}s  ${describeVideo(v)}` +
      `${describeAudio(r.facts)}${stream}`,
  );
  if (r.note) {
    console.log(`  ${r.note}`);
  }
  if (r.loudness) {
    const target = LOUDNESS_TARGET;
    console.log(
      `  measured (ebur128): ${r.loudness.lufs} LUFS integrated, ` +
        `${r.loudness.truePeak} dBTP true peak ` +
        `(target ${target.integrated} LUFS, <= ${target.truePeak} dBTP)`,
    );
  }
  if (r.poster) {
    const kb = (r.poster.sizeBytes / 1024).toFixed(0);
    console.log(
      `  poster: ${r.poster.file} (${kb} KB, frame at ${r.poster.time}s)`,
    );
  }
  console.log(`  hint (not checked) for ${r.name}: ${r.preset.hint}`);
  for (const w of r.warnings) {
    console.log(`warning: ${w}`);
  }
}

interface ExportJson {
  outputs: Array<Record<string, unknown>>;
}

function readJson(path: string): ExportJson {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as Partial<ExportJson>;
    return {outputs: data.outputs ?? []};
  } catch {
    return {outputs: []};
  }
}

/**
 * Adds this export to `export.json` beside the output file. An earlier
 * entry for the same file is replaced.
 */
export function recordResult(r: ExportResult): void {
  const path = join(dirname(r.out), 'export.json');
  const all = readJson(path);
  const {video: v, audio: a} = r.facts;
  all.outputs = all.outputs.filter(e => e.file !== r.out);
  all.outputs.push({
    preset: r.name,
    file: r.out,
    master: r.master,
    sizeBytes: r.facts.size,
    sizeMB: Number(megabytes(r.facts.size)),
    width: v.width,
    height: v.height,
    fps: v.fps,
    duration: r.facts.duration,
    videoCodec: v.gif ? 'gif' : v.codec,
    audioCodec: a ? a.codec : null,
    loudness: r.loudness,
    poster: r.poster,
    hint: r.preset.hint,
    warnings: r.warnings,
    command: r.command,
    exportedAt: new Date().toISOString(),
  });
  writeFileSync(path, JSON.stringify(all, null, 2));
}
