/**
 * @fileoverview The holds gate: each text must stay still long enough to be
 * read, at the film's reading rate plus a fixed base. Text that follows a
 * moving picture counts as still while it moves slower than a limit.
 * Seconds throughout.
 */
import type {FilmInfo, TextInfo} from '../../shared/contract.ts';
import {fastShare, longestSlowRun} from '../label-reading.ts';
import {quoted, r2, sceneLabel} from '../labels.ts';
import type {GateResult} from '../report.ts';
import {findings} from '../report.ts';
import {
  HOLD_FAIL_RATIO,
  LABEL_FAST_SHARE,
  LABEL_MAX_SPEED,
} from '../thresholds.ts';

/** Seconds a text can be read: still time, or slow-moving time. */
function readable(t: TextInfo): number {
  return t.motion ? longestSlowRun(t.motion, LABEL_MAX_SPEED) : t.hold;
}

/** Warns when a moving text is faster than the limit for most of its time. */
function fastWarning(info: FilmInfo, t: TextInfo): string | null {
  const share = t.motion ? fastShare(t.motion, LABEL_MAX_SPEED) : 0;
  if (share <= LABEL_FAST_SHARE) {
    return null;
  }
  return (
    `${sceneLabel(info, t.scene)} ${quoted(t.text)}: moves faster than ` +
    `${LABEL_MAX_SPEED * 100}% of the short side per second for ` +
    `${r2(share * 100)}% of its time on screen, so it is hard to read. ` +
    'Follow a slower point, show the label for a shorter part of the shot, ' +
    'or slow the camera'
  );
}

/**
 * Checks every text that is read as a sentence. A hold under 70% of the need
 * fails; under 100% warns. Numbers marked as not read have a need of 0 and
 * are skipped. A moving text also warns when it is faster than the limit
 * for most of its time on screen.
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
    const hold = readable(t);
    minRatio = Math.min(minRatio, hold / t.need);
    const fast = fastWarning(info, t);
    if (fast) {
      result.add('WARN', fast);
    }
    if (hold >= t.need) {
      continue;
    }
    const failBelow = HOLD_FAIL_RATIO * t.need;
    const how = t.motion ? 'readable (slow enough) for' : 'hold';
    const fix = t.motion
      ? 'Show the label for longer, follow a slower point, or cut words'
      : `Lengthen the scene by ${r2(t.need - hold)} s or cut words`;
    result.add(
      hold < failBelow ? 'FAIL' : 'WARN',
      `${sceneLabel(info, t.scene)} ${quoted(t.text)}: ${how} ${r2(hold)} s, ` +
        `need ${r2(t.need)} s for ${t.words} words (FAIL below ` +
        `${r2(failBelow)} s; settles at ${r2(t.settle)} s in a ` +
        `${info.scenes[t.scene]?.duration} s scene). ` +
        fix,
    );
  }
  if (measured === 0) {
    return {
      id: 'holds',
      status: 'SKIP',
      summary: 'no text to measure',
      details: [],
    };
  }
  const ratio = Number.isFinite(minRatio) ? r2(minRatio) : '-';
  return {
    id: 'holds',
    status: result.status,
    summary: `${measured} texts, worst hold/need ratio ${ratio}`,
    details: result.details,
  };
}
