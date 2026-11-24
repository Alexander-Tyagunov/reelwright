/**
 * @fileoverview The load gate: the film page opens and draws without
 * errors, and every font is available.
 */
import type {FilmInfo} from '../../shared/contract.ts';
import type {GateResult} from '../report.ts';

/**
 * Builds the load gate from the published film facts. A missing font only
 * warns, because a fallback font is drawn.
 */
export function gateLoad(info: FilmInfo): GateResult {
  const fonts = info.missingFonts;
  const size = `${info.width}x${info.height} ${info.fps} fps`;
  return {
    id: 'load',
    status: fonts.length ? 'WARN' : 'PASS',
    summary:
      `${size}, ${info.duration} s, ${info.scenes.length} scenes, ` +
      'no page errors',
    details: fonts.length
      ? [`WARN fonts not available, a fallback is drawn: ${fonts.join(', ')}`]
      : [],
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
 * the other gates drew frames. Does nothing for an empty list.
 *
 * @param errors Page error messages, without duplicates.
 */
export function applyPageErrors(gate: GateResult, errors: string[]): void {
  if (!errors.length) {
    return;
  }
  gate.status = 'FAIL';
  gate.summary = `${errors.length} page error(s) while drawing frames`;
  gate.details.push(...errors.map(e => `FAIL page error: ${e}`));
}
