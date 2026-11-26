/**
 * @fileoverview Chord plan of the bed: which chord sounds when. The plan
 * ends on the tonic chord and the last second of it is where the fade-out
 * lands on the film's end.
 */
import type {Palette} from './palette-types.ts';

/** Shortest closing chord, in seconds. */
const MIN_FINAL_S = 3;

/** Longest closing chord, in seconds. */
const MAX_FINAL_S = 6;

/** Share of the film the closing chord takes when that is in range. */
const FINAL_SHARE = 0.22;

/** A chord and the time it sounds. */
export interface ChordSpan {
  /** Film time in seconds where the chord starts. */
  start: number;
  /** Film time in seconds where the chord ends. */
  end: number;
  /** Scale degree of the chord root, 0 is the tonic. */
  degree: number;
  /** True for the first chord of the film. */
  first: boolean;
  /** True for the closing chord. */
  last: boolean;
}

/**
 * Seconds the closing chord lasts for a film.
 *
 * @param duration Film length in seconds.
 */
export function finalLength(duration: number): number {
  const wanted = Math.min(
    MAX_FINAL_S,
    Math.max(MIN_FINAL_S, duration * FINAL_SHARE),
  );
  return Math.min(wanted, duration * 0.7);
}

/**
 * Plans the chords of a film. The palette's progression repeats, with the
 * cadence chord just before the closing tonic chord.
 *
 * @param duration Film length in seconds.
 * @param palette Source of the progression and chord length.
 * @param tempo Beats per minute.
 * @returns Spans in time order that cover the film with no gap.
 */
export function planChords(
  duration: number,
  palette: Palette,
  tempo: number,
): ChordSpan[] {
  const closing = finalLength(duration);
  const body = duration - closing;
  const span = (palette.chordBeats * 60) / tempo;
  const count = body < 0.5 ? 0 : Math.max(1, Math.round(body / span));
  const spans: ChordSpan[] = [];
  for (let i = 0; i < count; i++) {
    const degree =
      i === count - 1 && count > 1
        ? palette.cadence
        : (palette.progression[i % palette.progression.length] ?? 0);
    const start = (body * i) / count;
    spans.push({
      start,
      end: (body * (i + 1)) / count,
      degree,
      first: i === 0,
      last: false,
    });
  }
  spans.push({
    start: body,
    end: duration,
    degree: 0,
    first: count === 0,
    last: true,
  });
  return spans;
}
