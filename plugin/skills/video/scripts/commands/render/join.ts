/**
 * @fileoverview Joins segment files into the final MP4 without re-encoding.
 */
import {renameSync, writeFileSync} from 'node:fs';
import {basename, join} from 'node:path';
import {run as exec} from '../../core/process.ts';
import type {Segment} from './plan.ts';

/**
 * Concatenates segments in order with the ffmpeg concat demuxer and stream
 * copy. Writes to a temporary file and renames it when done.
 *
 * @param segDir Folder for the temporary list file.
 * @param out Output `.mp4` path.
 */
export async function joinSegments(
  segments: readonly Segment[],
  segDir: string,
  out: string,
): Promise<void> {
  const stem = basename(out).replace(/\.[^.]+$/, '');
  const list = join(segDir, `concat-${stem}.txt`);
  const lines = segments.map(s => `file '${s.file.replace(/'/g, "'\\''")}'`);
  writeFileSync(list, `${lines.join('\n')}\n`);
  const tmp = `${out.replace(/\.mp4$/, '')}.tmp.mp4`;
  await exec('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    tmp,
  ]);
  renameSync(tmp, out);
}
