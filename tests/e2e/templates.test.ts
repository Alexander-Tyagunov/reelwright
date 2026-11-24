/**
 * @fileoverview The four starter templates: each passes the page gates in
 * landscape, square, portrait feed and vertical story sizes, and the release
 * template renders and passes the full gate.
 */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {after, describe, it} from 'node:test';
import {missingTools, reel} from '../helpers/cli.ts';
import {gateOf, qa, readReport, render, workspace} from '../helpers/project.ts';

const ws = workspace();
after(() => ws.dispose());

const TEMPLATES = ['release', 'metrics', 'explainer', 'blank'] as const;
const SIZES = ['1920x1080', '1080x1080', '1080x1350', '1080x1920'] as const;

async function fromTemplate(name: string) {
  const dir = join(ws.root, name);
  const made = await reel(ws.root, ['init', dir, '--template', name]);
  assert.equal(made.code, 0, made.output);
  return {dir, spec: join(dir, 'film.json')};
}

describe('templates', {skip: missingTools(), timeout: 1_800_000}, () => {
  for (const name of TEMPLATES) {
    it(`the ${name} template passes the page gates at every delivery size`, async () => {
      const p = await fromTemplate(name);
      for (const size of SIZES) {
        const suffix = size === '1920x1080' ? '' : `-${size}`;
        const extra = size === '1920x1080' ? [] : ['--size', size];
        const {report} = await qa(p, ['--page-only', ...extra], suffix);
        const problems = report.gates.flatMap(g =>
          g.details.filter(d => /^(FAIL|WARN)/.test(d)),
        );
        assert.equal(
          report.verdict,
          'pass',
          `${name} at ${size}:\n${problems.join('\n')}`,
        );
      }
    });
  }

  it('the release template renders and passes the full gate', async () => {
    const dir = join(ws.root, 'release');
    await render({dir, spec: join(dir, 'film.json')});
    const {code} = await qa({dir, spec: join(dir, 'film.json')});
    const report = readReport(dir);
    for (const id of [
      'load',
      'determinism',
      'layout',
      'holds',
      'pacing',
      'probe',
      'motion',
    ] as const) {
      assert.equal(
        gateOf(report, id).status,
        'PASS',
        `${id}: ${gateOf(report, id).details.join('; ')}`,
      );
    }
    assert.equal(report.verdict, 'pass');
    assert.equal(code, 0);
  });
});
