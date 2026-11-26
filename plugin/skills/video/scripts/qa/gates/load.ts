/**
 * @fileoverview The load gate: the film page opens and draws without
 * errors, and every font is available.
 */
import type {FilmInfo} from '../../shared/contract.ts';
import type {GateResult} from '../report.ts';

/**
 * Builds the load gate from the published film facts. A missing font only
 * warns, because a fallback font is drawn. So does each load warning, such
 * as a plate that is shorter than its scene.
 */
export function gateLoad(info: FilmInfo): GateResult {
  const fonts = info.missingFonts;
  const size = `${info.width}x${info.height} ${info.fps} fps`;
  const details = [
    ...(fonts.length
      ? [`WARN fonts not available, a fallback is drawn: ${fonts.join(', ')}`]
      : []),
    ...info.warnings.map(w => `WARN ${w}`),
  ];
  return {
    id: 'load',
    status: details.length ? 'WARN' : 'PASS',
    summary:
      `${size}, ${info.duration} s, ${info.scenes.length} scenes, ` +
      'no page errors',
    details,
  };
}

/**
 * Builds the failed load gate for a page that did not open.
 *
 * @param message What the browser or the spec loader reported.
 */
export function loadFailure(message: string): GateResult {
  return {
    id: 'load',
    status: 'FAIL',
    summary: 'the film page did not open',
    details: [`FAIL ${message}`],
  };
}

/**
 * Turns the load gate into a failure when the page reported errors while
 * the gates drew frames. Errors already listed are not repeated. Does
 * nothing for an empty list.
 *
 * @param errors Page error messages, without duplicates.
 */
export function applyPageErrors(gate: GateResult, errors: string[]): void {
  const fresh = errors.filter(e => !gate.details.some(d => d.includes(e)));
  if (!fresh.length) {
    return;
  }
  gate.status = 'FAIL';
  gate.summary = `${fresh.length} page error(s) while drawing frames`;
  gate.details.push(...fresh.map(e => `FAIL page error: ${e}`));
}

/**
 * Turns the load gate into a failure when scenes threw while they were
 * drawn. Does nothing for an empty list.
 *
 * @param failures One message per failing scene, as the scene reports it.
 */
export function applyDrawFailures(
  gate: GateResult,
  failures: readonly string[],
): void {
  if (!failures.length) {
    return;
  }
  gate.status = 'FAIL';
  gate.summary = `${failures.length} scene(s) threw while drawing frames`;
  gate.details.push(...failures.map(f => `FAIL ${f}`));
}
