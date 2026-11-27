/**
 * @fileoverview Plans the cues of a film: from the picture (scene changes,
 * text that settles, the last scene) and from the
 * explicit `cues` of each scene. Pure: the same input gives the same list.
 */
import type {CueKind, FilmInfo, SceneSpec} from '../shared/contract.ts';
import {AUTO_ALL, type AutoCues} from './auto-cues.ts';
import type {Palette} from './palette-types.ts';
import {degreeHz} from './scale.ts';
import {sceneCues} from './scene-cues.ts';

/** Fewest seconds between two cues that come from the picture. */
export const MIN_CUE_GAP_S = 0.18;

/** Where a cue came from. */
export type CueSource = 'transition' | 'text' | 'ending' | 'spec';

/** One sound to play, with everything the renderer needs. */
export interface Cue {
  /** Film time in seconds. A whoosh is centred on it. A rise starts on it. */
  t: number;
  kind: CueKind;
  /** Linear level from 0 to 1. */
  gain: number;
  /** Pitch in hertz, or null for a sound with no pitch. */
  hz: number | null;
  /** Length in seconds for a rise, otherwise null. */
  duration: number | null;
  source: CueSource;
}

/** The parts of the film info that cue planning reads. */
export type CueInfo = Pick<
  FilmInfo,
  'duration' | 'scenes' | 'texts' | 'overlap'
>;

/** Settings that give cues their pitch. */
export interface CueKey {
  palette: Palette;
  /** Root note name such as `A`. */
  key: string;
}

function pitch(k: CueKey, degree: number, octaveShift = 0): number {
  const {palette} = k;
  return degreeHz(
    k.key,
    palette.scale,
    degree,
    palette.cue.octave + octaveShift,
  );
}

function textGain(words: number): number {
  return words <= 3 ? 1 : words <= 8 ? 0.7 : 0.45;
}

function structural(info: CueInfo, k: CueKey, auto: AutoCues): Cue[] {
  const out: Cue[] = [];
  const last = info.scenes[info.scenes.length - 1];
  if (last && info.scenes.length > 1 && auto.ending > 0) {
    const hz = hzFor('chime', k, 0);
    out.push({
      t: last.start,
      kind: 'chime',
      gain: 0.9 * auto.ending,
      hz,
      duration: null,
      source: 'ending',
    });
  }
  info.scenes.forEach((s, i) => {
    if (i > 0 && auto.transition > 0) {
      const t = s.start + info.overlap / 2;
      out.push({
        t,
        kind: 'whoosh',
        gain: 0.8 * auto.transition,
        hz: null,
        duration: null,
        source: 'transition',
      });
    }
  });
  return out;
}

function ticks(info: CueInfo, k: CueKey, level: number): Cue[] {
  const run = k.palette.tickRun;
  const placed = new Map<number, number>();
  const out: Cue[] = [];
  for (const x of info.texts) {
    const scene = info.scenes[x.scene];
    if (!scene || x.need === 0 || x.settle < 0.05) {
      continue;
    }
    const n = placed.get(x.scene) ?? 0;
    placed.set(x.scene, n + 1);
    const hz = pitch(k, run[n % run.length] ?? 0);
    const t = scene.start + x.settle;
    out.push({
      t,
      kind: 'tick',
      gain: textGain(x.words) * level,
      hz,
      duration: null,
      source: 'text',
    });
  }
  return out;
}

function explicit(
  info: CueInfo,
  scenes: readonly SceneSpec[],
  k: CueKey,
): Cue[] {
  const out: Cue[] = [];
  scenes.forEach((spec, i) => {
    const at = info.scenes[i]?.start ?? 0;
    sceneCues(spec, i).forEach((c, n) => {
      const hz = c.kind === 'whoosh' ? null : hzFor(c.kind, k, n);
      out.push({
        t: Math.max(0, at + c.at),
        kind: c.kind,
        gain: c.gain ?? 1,
        hz,
        duration: c.kind === 'rise' ? (c.duration ?? 2) : null,
        source: 'spec',
      });
    });
  });
  return out;
}

function hzFor(kind: CueKind, k: CueKey, n: number): number {
  const {palette} = k;
  if (kind === 'hit' || kind === 'boom') {
    return degreeHz(k.key, palette.scale, 0, palette.cue.impactOctave);
  }
  if (kind === 'sting') {
    return pitch(k, 0);
  }
  if (kind === 'chime') {
    return pitch(k, 0, 1);
  }
  if (kind === 'rise') {
    return pitch(k, 0, -1);
  }
  return pitch(k, palette.tickRun[n % palette.tickRun.length] ?? 0);
}

/**
 * Plans every cue of a film.
 *
 * Derived cues: a whoosh centred on each scene change, a chime at the start
 * of the last scene, and a tick where a text block settles, quieter for
 * longer text. A tick gives way to any cue within {@link MIN_CUE_GAP_S}
 * seconds, so a list of rows never machine-guns. Explicit cues are always
 * kept, and so are the other derived cues that `auto` leaves on.
 *
 * @param info Film duration, scene starts and text settle times, in seconds.
 * @param scenes Scene specs, for their explicit `cues`.
 * @param k Palette and key that decide the pitches.
 * @param auto How much each kind of derived cue plays, 0 to 1 as a gain
 *   multiplier; 0 drops the kind. Default: every kind at its planned gain.
 * @returns Cues sorted by time.
 * @throws UserError when an explicit cue is malformed.
 */
export function planCues(
  info: CueInfo,
  scenes: readonly SceneSpec[],
  k: CueKey,
  auto: AutoCues = AUTO_ALL,
): Cue[] {
  const kept = [...explicit(info, scenes, k), ...structural(info, k, auto)];
  const crowded = (t: number): boolean =>
    kept.some(c => Math.abs(c.t - t) < MIN_CUE_GAP_S);
  for (const c of (auto.text > 0 ? ticks(info, k, auto.text) : []).sort(
    (a, b) => a.t - b.t,
  )) {
    if (!crowded(c.t)) {
      kept.push(c);
    }
  }
  return kept
    .filter(c => c.t >= 0 && c.t < info.duration)
    .sort((a, b) => a.t - b.t);
}
