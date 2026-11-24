/**
 * @fileoverview The delivery presets of `export` and their plain-language
 * descriptions.
 */
import {table} from '../../core/table.ts';

/** One delivery preset. */
export interface Preset {
  /** File extension without the dot. */
  ext: string;
  /** What the preset makes. */
  what: string;
  /** Platform guidance. It is advice, not a check. */
  hint: string;
}

const H264_MP4 = 'H.264 High, yuv420p, faststart, AAC 192k';

/** All presets by name. */
export const PRESETS: Readonly<Record<string, Preset>> = {
  master: {
    ext: 'mp4',
    what: 'the rendered master, copied unchanged',
    hint: 'untouched copy of the render; keep it as your archive',
  },
  x: {
    ext: 'mp4',
    what: H264_MP4,
    hint: '16:9 1920x1080 or 4:5 1080x1350, up to 60 fps, H.264 + AAC',
  },
  linkedin: {
    ext: 'mp4',
    what: H264_MP4,
    hint:
      '1:1 or 4:5 performs best in the feed; most people watch muted, ' +
      'so use captions',
  },
  youtube: {
    ext: 'mp4',
    what: H264_MP4,
    hint:
      '16:9 at 1920x1080 or larger; vertical 9:16 under 3 minutes can run ' +
      'as a Short',
  },
  slack: {
    ext: 'mp4',
    what: H264_MP4,
    hint: 'keep under ~25 MB for inline play',
  },
  web: {
    ext: 'mp4',
    what: H264_MP4,
    hint:
      'faststart MP4 starts playing while it downloads; add the webm ' +
      'preset for a lighter embed',
  },
  gif: {
    ext: 'gif',
    what: 'palette-optimised GIF, 15 fps, 960 px wide (--gif-fps, --gif-width)',
    hint: 'short silent loops only; stay under 15 MB',
  },
  webm: {
    ext: 'webm',
    what: 'VP9 CRF 32 (+ Opus 128k with audio)',
    hint: 'for web embeds; smaller than MP4 at the same look',
  },
};

/** Preset names, in display order. */
export const PRESET_NAMES: readonly string[] = Object.keys(PRESETS);

/** Text of `export --preset list`. */
export function presetListing(): string {
  const rows = Object.entries(PRESETS).map(([name, p]) => [
    name,
    `.${p.ext}`,
    p.what,
    p.hint,
  ]);
  const grid = table([['preset', 'file', 'what it makes', 'hint'], ...rows]);
  return (
    `${grid}\n\nHints are plain guidance, not checks. Add --audio ` +
    'music.mp3 to the mp4/webm presets; add --poster auto for a PNG still.'
  );
}
