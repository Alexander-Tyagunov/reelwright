/**
 * @fileoverview The cuts gate: the brightness and loudness on both sides of
 * every cut of the finished film. It only warns; a cut that jumps is often a
 * choice, so it never fails a film.
 */
import type {FilmSpec} from '../../shared/contract.ts';
import type {CutReport} from '../cuts.ts';
import {measureCuts} from '../cuts-run.ts';
import type {GateResult} from '../report.ts';
import {CUT_BRIGHTNESS_JUMP, CUT_LOUDNESS_JUMP_LU} from '../thresholds.ts';

/**
 * Judges measured cuts. Warns for each cut whose brightness changes by more
 * than 50% or whose loudness rises by more than 6 LU. Never fails.
 */
export function gateCuts(cuts: readonly CutReport[]): GateResult {
  const flagged = cuts.filter(c => c.flags.length);
  const details = flagged.map(
    c =>
      `WARN ${c.at.toFixed(2)} s ${c.from} -> ${c.to}: ${c.flags.join('; ')}`,
  );
  const limits = `limits ${CUT_BRIGHTNESS_JUMP * 100}% and ${CUT_LOUDNESS_JUMP_LU} LU`;
  return {
    id: 'cuts',
    status: flagged.length ? 'WARN' : cuts.length ? 'PASS' : 'SKIP',
    summary: cuts.length
      ? `${cuts.length} cuts, ${flagged.length} flagged (${limits})`
      : 'no cuts',
    details,
  };
}

/**
 * Measures the cuts of a rendered film and judges them. A film that cannot
 * be measured gives a warning, never a failure.
 */
export async function auditCuts(
  film: FilmSpec,
  video: string,
): Promise<GateResult> {
  try {
    return gateCuts(await measureCuts(film, video));
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    const line = why.split('\n')[0] ?? why;
    return {
      id: 'cuts',
      status: 'WARN',
      summary: `could not measure the cuts: ${line}`,
      details: [`WARN ${line}`],
    };
  }
}
