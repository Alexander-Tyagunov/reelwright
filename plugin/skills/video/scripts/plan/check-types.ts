/**
 * @fileoverview The result type shared by the checks of `reel plan`.
 */

/** Outcome of one check. A `WARN` does not fail the plan. */
export type CheckStatus = 'PASS' | 'WARN' | 'FAIL';

/** One check of a plan and what it found. */
export interface Check {
  name: string;
  status: CheckStatus;
  /** One line on what was measured; shown when the check passes. */
  note: string;
  /** What is wrong, one line each. */
  problems: string[];
}

/**
 * Builds a check result. The status is `fail` or `warn` when there are
 * problems, and `PASS` when there are none.
 *
 * @param severity Status to use when there are problems.
 */
export function result(
  name: string,
  problems: string[],
  note = '',
  severity: 'FAIL' | 'WARN' = 'FAIL',
): Check {
  return {name, status: problems.length ? severity : 'PASS', note, problems};
}
