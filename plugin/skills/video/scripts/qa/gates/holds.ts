/**
 * @fileoverview The holds gate: each text must stay still long enough to be
 * read, at the film's reading rate plus a fixed base. Seconds throughout.
 */
import type {FilmInfo} from '../../shared/contract.ts';
import {quoted, r2, sceneLabel} from '../labels.ts';
import type {GateResult} from '../report.ts';
import {findings} from '../report.ts';
import {HOLD_FAIL_RATIO} from '../thresholds.ts';

/**
 * Checks every text that is read as a sentence. A hold under 70% of the need
 * fails; under 100% warns. Numbers marked as not read have a need of 0 and
 * are skipped.
 */
export function gateHolds(info: FilmInfo): GateResult {
  const result = findings();
  let measured = 0;
  let minRatio = Number.POSITIVE_INFINITY;
  for (const t of info.texts) {
    if (!(t.need > 0)) {
      continue;
    }
    measured++;
    minRatio = Math.min(minRatio, t.hold / t.need);
    const failBelow = HOLD_FAIL_RATIO * t.need;
    if (t.hold >= t.need) {
      continue;
    }
    const length = info.scenes[t.scene]?.duration;
    result.add(
      t.hold < failBelow ? 'FAIL' : 'WARN',
      `${sceneLabel(info, t.scene)} ${quoted(t.text)}: hold ${r2(t.hold)} s, ` +
        `need ${r2(t.need)} s for ${t.words} words (FAIL below ` +
        `${r2(failBelow)} s; settles at ${r2(t.settle)} s in a ${length} s ` +
        `scene). Lengthen the scene by ${r2(t.need - t.hold)} s or cut words`,
    );
  }
  const ratio = Number.isFinite(minRatio) ? r2(minRatio) : '-';
  return {
    id: 'holds',
    status: result.status,
    summary: `${measured} texts, worst hold/need ratio ${ratio}`,
    details: result.details,
  };
}
