/**
 * @fileoverview The audio gate: integrated loudness and true peak of the
 * finished file, and, when the film asks for sound, that the sound is in the
 * file and as long as the picture. Levels are in LUFS and dBTP.
 */
import {UserError} from '../../core/errors.ts';
import type {Loudness} from '../../video/loudness.ts';
import {measureLoudness} from '../../video/loudness.ts';
import {r2, r3} from '../labels.ts';
import type {GateResult} from '../report.ts';
import {findings} from '../report.ts';
import {
  AUDIO_SYNC_MAX_S,
  LUFS_MAX,
  LUFS_MIN,
  TRUE_PEAK_MAX,
} from '../thresholds.ts';

/**
 * Judges a loudness measurement. Warns when the integrated loudness is
 * outside -16 to -12 LUFS or the true peak is above -1 dBTP.
 *
 * @param loudness The measurement, or null when it could not be made.
 */
export function gateAudio(loudness: Loudness | null): GateResult {
  if (!loudness || !Number.isFinite(loudness.lufs)) {
    return {
      id: 'audio',
      status: 'WARN',
      summary: 'could not measure loudness (silent or unreadable audio)',
      details: ['WARN ebur128 returned no integrated loudness'],
    };
  }
  const {lufs, truePeak} = loudness;
  const result = findings();
  if (lufs < LUFS_MIN || lufs > LUFS_MAX) {
    const edge = lufs < LUFS_MIN ? LUFS_MIN : LUFS_MAX;
    result.add(
      'WARN',
      `integrated loudness ${lufs} LUFS, target ${LUFS_MIN} to ${LUFS_MAX} ` +
        `LUFS (change gain by ${r2(edge - lufs)} dB toward the range)`,
    );
  }
  if (Number.isFinite(truePeak) && truePeak > TRUE_PEAK_MAX) {
    result.add(
      'WARN',
      `true peak ${truePeak} dBTP, limit ${TRUE_PEAK_MAX} dBTP`,
    );
  }
  const peak = Number.isFinite(truePeak) ? truePeak : 'n/a';
  return {
    id: 'audio',
    status: result.status,
    summary: `${lufs} LUFS integrated, true peak ${peak} dBTP`,
    details: result.details,
  };
}

/** What the track check needs to know about the file and the spec. */
export interface TrackFacts {
  /** `meta.sound` is on in the spec. */
  soundOn: boolean;
  /** The file has an audio stream. */
  hasAudio: boolean;
  /** Length of the audio stream in seconds, or null when unknown. */
  audioSeconds: number | null;
  /** Length of the video stream in seconds, or null when unknown. */
  videoSeconds: number | null;
}

/**
 * Checks that the audio track exists when the film asks for sound and that
 * audio and video have the same length.
 *
 * @returns A failed result, or null when the track is fine.
 */
export function gateAudioTrack(f: TrackFacts): GateResult | null {
  const fail = (text: string): GateResult => ({
    id: 'audio',
    status: 'FAIL',
    summary: text,
    details: [`FAIL ${text}`],
  });
  if (f.soundOn && !f.hasAudio) {
    return fail(
      'meta.sound is on but the video has no audio track: run render again ' +
        '(without --no-sound) to add the sound',
    );
  }
  const {audioSeconds: a, videoSeconds: v} = f;
  if (f.hasAudio && a !== null && v !== null) {
    const diff = r3(a - v);
    if (Math.abs(diff) > AUDIO_SYNC_MAX_S) {
      const word = diff < 0 ? 'shorter' : 'longer';
      return fail(
        `audio is ${r3(a)}s, ${Math.abs(diff)}s ${word} than the video ` +
          `(${r3(v)}s), limit ${AUDIO_SYNC_MAX_S}s: run render again`,
      );
    }
  }
  return null;
}

/**
 * Measures a file and runs the gate. Without an audio track the gate is
 * skipped, unless the film asks for sound, which fails it.
 */
export async function auditAudio(
  video: string,
  track: TrackFacts,
): Promise<GateResult> {
  const broken = gateAudioTrack(track);
  if (broken) {
    return broken;
  }
  if (!track.hasAudio) {
    return {id: 'audio', status: 'SKIP', summary: 'no audio', details: []};
  }
  try {
    return gateAudio(await measureLoudness(video));
  } catch (e) {
    if (e instanceof UserError) {
      return gateAudio(null);
    }
    throw e;
  }
}
