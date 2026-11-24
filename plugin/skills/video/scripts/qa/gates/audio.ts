/**
 * @fileoverview The audio gate: integrated loudness and true peak of the
 * finished file. It never fails. Levels are in LUFS and dBTP.
 */
import {UserError} from '../../core/errors.ts';
import type {Loudness} from '../../video/loudness.ts';
import {measureLoudness} from '../../video/loudness.ts';
import {r2} from '../labels.ts';
import type {GateResult} from '../report.ts';
import {findings} from '../report.ts';
import {LUFS_MAX, LUFS_MIN, TRUE_PEAK_MAX} from '../thresholds.ts';

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

/**
 * Measures a file and runs the gate. The gate is skipped for a file with no
 * audio track.
 */
export async function auditAudio(
  video: string,
  hasAudio: boolean,
): Promise<GateResult> {
  if (!hasAudio) {
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
