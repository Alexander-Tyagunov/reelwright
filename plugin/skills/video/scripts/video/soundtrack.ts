/**
 * @fileoverview Makes the soundtrack file of a film: plans the cues from
 * the picture, synthesises the track, sets its loudness with the same
 * measurement the audio gate uses, and writes `sound.wav` and `sound.json`.
 */
import {mkdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import type {StereoBuffer} from '../audio/buffer.ts';
import {dbToGain, SAMPLE_RATE} from '../audio/buffer.ts';
import {composeTrack} from '../audio/compose.ts';
import type {Cue} from '../audio/cues.ts';
import {planCues} from '../audio/cues.ts';
import {limitBuffer} from '../audio/limiter.ts';
import type {ResolvedSound} from '../audio/sound-spec.ts';
import {encodeWav} from '../audio/wav.ts';
import {onStop} from '../core/cleanup.ts';
import type {Outputs} from '../core/outputs.ts';
import type {FilmInfo, FilmSpec} from '../shared/contract.ts';
import type {Loudness} from './loudness.ts';
import {LOUDNESS_TARGET, measureLoudness} from './loudness.ts';

/** Largest distance from the loudness target that is accepted, in LU. */
const LUFS_TOLERANCE = 0.3;

/** Most measurement rounds before the best track so far is kept. */
const MAX_ROUNDS = 4;

/** Room kept under the true peak target for the AAC encode, in dB. */
const PEAK_MARGIN_DB = 1.5;

/** What was made. */
export interface Soundtrack {
  /** Absolute path of the WAV file. */
  file: string;
  /** Absolute path of the cue list. */
  json: string;
  /** Length in seconds. */
  duration: number;
  /** Planned cues, in time order. */
  cues: Cue[];
  /** Measured loudness of the written file. */
  loudness: Loudness;
  /** Palette name. */
  palette: string;
}

/** Where and for what the track is made. */
export interface SoundtrackInput {
  info: Pick<FilmInfo, 'duration' | 'scenes' | 'texts' | 'overlap'>;
  film: FilmSpec;
  sound: ResolvedSound;
  /** Output names of the spec. The `out` folder is created when missing. */
  names: Outputs;
  /** Text after `sound` in the file names, such as `-1080x1920`. */
  suffix: string;
}

function scaled(base: StereoBuffer, gainDb: number, ceilingDb: number) {
  const k = dbToGain(gainDb);
  const out = {
    left: new Float32Array(base.left.length),
    right: new Float32Array(base.right.length),
  };
  for (let i = 0; i < out.left.length; i++) {
    out.left[i] = (base.left[i] ?? 0) * k;
    out.right[i] = (base.right[i] ?? 0) * k;
  }
  limitBuffer(out, ceilingDb);
  return out;
}

function writeAtomic(path: string, bytes: Uint8Array | string): void {
  const tmp = `${path}.tmp`;
  const forget = onStop(() => rmSync(tmp, {force: true}));
  try {
    writeFileSync(tmp, bytes);
    renameSync(tmp, path);
  } finally {
    rmSync(tmp, {force: true});
    forget();
  }
}

async function fitLoudness(
  base: StereoBuffer,
  volume: number,
  scratch: string,
): Promise<{track: StereoBuffer; loudness: Loudness}> {
  const target = LOUDNESS_TARGET.integrated + 20 * Math.log10(volume);
  let gainDb = 0;
  let ceiling = LOUDNESS_TARGET.truePeak - PEAK_MARGIN_DB;
  let best = {track: base, loudness: {lufs: -Infinity, truePeak: -Infinity}};
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const track = scaled(base, gainDb, ceiling);
    writeAtomic(scratch, encodeWav(track));
    const loudness = await measureLoudness(scratch);
    best = {track, loudness};
    const off = target - loudness.lufs;
    const hot = loudness.truePeak - LOUDNESS_TARGET.truePeak;
    if (Math.abs(off) <= LUFS_TOLERANCE && hot <= 0) {
      break;
    }
    gainDb += off;
    ceiling -= Math.max(0, hot);
  }
  return best;
}

/**
 * Makes `sound[suffix].wav` and `sound[suffix].json` in `outDir`.
 *
 * The loudness lands within 0.3 LU of -14 LUFS (lower by `volume`) and the
 * true peak of the WAV at or below -1.5 dBTP. The AAC encode in the MP4 adds
 * up to about 1 dB, so the sample ceiling sits 1.5 dB lower still. The WAV is 48 kHz, 16-bit, stereo, and
 * as long as the film.
 *
 * @throws UserError when ffmpeg is missing or cannot measure the track.
 */
export async function makeSoundtrack(i: SoundtrackInput): Promise<Soundtrack> {
  const {sound: s, info} = i;
  const key = {palette: s.palette, key: s.key};
  const cues = s.cues ? planCues(info, i.film.scenes, key, s.auto) : [];
  const base = composeTrack({
    palette: s.palette,
    key: s.key,
    tempo: s.tempo,
    seed: s.seed,
    duration: info.duration,
    bed: s.bed,
    intensity: s.intensity,
    cues,
  });
  mkdirSync(i.names.dir, {recursive: true});
  const file = i.names.sound('wav', i.suffix);
  const json = i.names.sound('json', i.suffix);
  const scratch = i.names.soundScratch(i.suffix);
  const fitted =
    s.volume > 0
      ? await fitLoudness(base, s.volume, scratch)
      : {track: muted(base), loudness: {lufs: -Infinity, truePeak: -Infinity}};
  rmSync(scratch, {force: true});
  writeAtomic(file, encodeWav(fitted.track));
  const result = {
    file,
    json,
    duration: info.duration,
    cues,
    loudness: fitted.loudness,
    palette: s.palette.name,
  };
  writeAtomic(json, JSON.stringify(report(s, result), null, 2));
  return result;
}

function muted(base: StereoBuffer): StereoBuffer {
  const n = base.left.length;
  return {left: new Float32Array(n), right: new Float32Array(n)};
}

function report(s: ResolvedSound, r: Soundtrack) {
  const num = (v: number): number | null => (Number.isFinite(v) ? v : null);
  return {
    palette: s.palette.name,
    key: s.key,
    tempo: s.tempo,
    seed: s.seed,
    volume: s.volume,
    bed: s.bed,
    cues: r.cues.map(c => ({
      t: Number(c.t.toFixed(3)),
      kind: c.kind,
      source: c.source,
      gain: c.gain,
      hz: c.hz === null ? null : Number(c.hz.toFixed(2)),
      duration: c.duration,
    })),
    intensity: s.intensity,
    duration: r.duration,
    sampleRate: SAMPLE_RATE,
    lufs: num(r.loudness.lufs),
    truePeak: num(r.loudness.truePeak),
  };
}
