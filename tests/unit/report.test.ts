/**
 * @fileoverview The verdict and the exit code of `qa`, and how the report
 * reads on a terminal.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {GateResult} from '../../plugin/skills/video/scripts/qa/report.ts';
import {
  buildReport,
  crashedGate,
  exitCodeFor,
  formatReport,
  verdictOf,
} from '../../plugin/skills/video/scripts/qa/report.ts';

const gate = (
  status: GateResult['status'],
  id: GateResult['id'] = 'layout',
): GateResult => ({
  id,
  status,
  summary: 'a summary',
  details: status === 'PASS' ? [] : [`${status} something to fix`],
});

describe('qa verdict', () => {
  it('any failed gate fails the run, even with warnings and a missing video', () => {
    assert.equal(verdictOf([gate('WARN'), gate('FAIL')], true), 'fail');
  });

  it('page gates that pass without a video are incomplete', () => {
    assert.equal(
      verdictOf([gate('PASS'), gate('SKIP', 'probe')], true),
      'incomplete',
    );
  });

  it('warnings alone give warn, and clean gates give pass', () => {
    assert.equal(verdictOf([gate('PASS'), gate('WARN')], false), 'warn');
    assert.equal(
      verdictOf([gate('PASS'), gate('SKIP', 'audio')], false),
      'pass',
    );
  });

  it('fail and incomplete exit 1; warn exits 1 only with --strict', () => {
    assert.equal(exitCodeFor('fail', false), 1);
    assert.equal(exitCodeFor('incomplete', false), 1);
    assert.equal(exitCodeFor('warn', false), 0);
    assert.equal(exitCodeFor('warn', true), 1);
    assert.equal(exitCodeFor('pass', true), 0);
  });

  it('a gate that crashes is a failure, never a pass', () => {
    const g = crashedGate('motion', new Error('ffmpeg exited 1\nmore'));
    assert.equal(g.status, 'FAIL');
    assert.equal(g.summary, 'gate crashed: ffmpeg exited 1');
    assert.doesNotMatch(g.details.join('\n'), /\n\s+at /, 'no stack');
  });

  it('a page-only run says that the video gates are still to do', () => {
    const report = buildReport({
      film: {},
      video: null,
      gates: [gate('PASS')],
      incomplete: false,
      pageOnly: true,
    });
    assert.equal(report.verdict, 'pass');
    assert.match(report.note ?? '', /page gates only/);
  });

  it('the printed report lists each warning under its gate and ends with the verdict', () => {
    const report = buildReport({
      film: {},
      video: null,
      gates: [gate('PASS', 'load'), gate('WARN', 'layout')],
      incomplete: false,
      pageOnly: false,
    });
    const text = formatReport(report, '/tmp/out/qa-report.json');
    assert.match(text, /layout WARN:\n {2}WARN something to fix/);
    assert.match(
      text,
      /verdict: WARN {2}\(report: \/tmp\/out\/qa-report\.json\)/,
    );
  });
});
