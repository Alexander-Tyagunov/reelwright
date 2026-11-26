/**
 * @fileoverview Joins segment files into the final MP4 without re-encoding.
 */
import {renameSync, rmSync, writeFileSync} from 'node:fs';
import {basename, join} from 'node:path';
import {onStop} from '../../core/cleanup.ts';
import {run as exec} from '../../core/process.ts';
import type {Segment} from './plan.ts';

/**
 * Concatenates segments in order with the ffmpeg concat demuxer and stream
 * copy. Writes to a temporary file and renames it when done.
 *
 * @param segDir Folder for the temporary list file.
 * @param out Output `.mp4` path.
 * @param audio Path of a WAV soundtrack to add as AAC, or null for a silent
 *   film. The video is never re-encoded.
 */
export async function joinSegments(
  segments: readonly Segment[],
  segDir: string,
  out: string,
  audio: string | null,
): Promise<void> {
  const stem = basename(out).replace(/\.[^.]+$/, '');
  const list = join(segDir, `concat-${stem}.txt`);
  const lines = segments.map(s => `file '${s.file.replace(/'/g, "'\\''")}'`);
  writeFileSync(list, `${lines.join('\n')}\n`);
  const tmp = `${out.replace(/\.mp4$/, '')}.tmp.mp4`;
  const input = ['-f', 'concat', '-safe', '0', '-i', list];
  const sound = audio
    ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k']
    : [];
  const forget = onStop(() => rmSync(tmp, {force: true}));
  try {
    await exec('ffmpeg', [
      ...['-hide_banner', '-loglevel', 'error', '-y'],
      ...input,
      ...sound,
      ...['-c:v', 'copy', '-movflags', '+faststart', tmp],
    ]);
    renameSync(tmp, out);
  } finally {
    rmSync(tmp, {force: true});
    forget();
  }
}
