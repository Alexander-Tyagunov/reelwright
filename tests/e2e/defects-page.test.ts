/**
 * @fileoverview Films with one seeded defect each that the page gates must
 * catch, run through the real command line without rendering.
 */
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {missingTools} from '../helpers/cli.ts';
import {goodFilm, withScene} from '../helpers/films.ts';
import {detail, gateOf, qa, SMALL, workspace} from '../helpers/project.ts';
import * as scenes from '../helpers/scenes.ts';

const ws = workspace();
after(() => ws.dispose());
const skip = missingTools();
const PAGE = ['--page-only'];

describe('page gates catch seeded defects', {skip, timeout: 600_000}, () => {
  it('random: Math.random in a frame function fails determinism', async () => {
    const p = ws.project(
      'random',
      withScene('Random', {type: 'random-scene', heading: 'Jitter by chance'}),
      {'random.ts': scenes.RANDOM},
    );
    const {report, code} = await qa(p, PAGE);
    const gate = gateOf(report, 'determinism');
    assert.equal(gate.status, 'FAIL');
    assert.match(
      detail(gate, /^FAIL/),
      /depends on history, a clock or Math\.random/,
    );
    assert.equal(report.verdict, 'fail');
    assert.equal(code, 1);
  });

  it('stateful: a counter carried across frames fails determinism', async () => {
    const p = ws.project(
      'stateful',
      withScene('Stateful', {
        type: 'stateful-scene',
        heading: 'Counting calls',
      }),
      {'stateful.ts': scenes.STATEFUL},
    );
    const {report} = await qa(p, PAGE);
    assert.equal(gateOf(report, 'determinism').status, 'FAIL');
  });

  it('off-frame: a heading half outside the frame fails layout', async () => {
    const p = ws.project(
      'offframe',
      withScene('Offframe', {
        type: 'offframe-scene',
        heading: 'Half outside the frame',
      }),
      {'offframe.ts': scenes.OFF_FRAME},
    );
    const {report} = await qa(p, PAGE);
    const gate = gateOf(report, 'layout');
    assert.equal(gate.status, 'FAIL');
    assert.match(
      detail(gate, /outside/),
      /"Half outside the frame": .* px outside the safe area at the left edge/,
    );
  });

  it('overlap: two texts at the same place fail layout', async () => {
    const film = withScene('Overlap', {
      type: 'overlap-scene',
      a: 'First line of text',
      b: 'Second line on top',
    });
    const p = ws.project('overlap', film, {'overlap.ts': scenes.OVERLAP});
    const {report} = await qa(p, PAGE);
    const gate = gateOf(report, 'layout');
    assert.equal(gate.status, 'FAIL');
    assert.match(detail(gate, /overlaps/), /overlaps .* of the smaller box/);
  });

  it('short-hold: a 14-word title in 1.4 s fails holds', async () => {
    const title =
      'This title has far too many words to be read in only one point four seconds';
    const p = ws.project('shorthold', {
      meta: {title: 'Short hold', ...SMALL},
      scenes: [{type: 'title', duration: 1.4, title}],
    });
    const {report} = await qa(p, PAGE);
    const gate = gateOf(report, 'holds');
    assert.equal(gate.status, 'FAIL');
    assert.match(detail(gate, /^FAIL/), /Lengthen the scene by/);
  });

  it('low-contrast: text almost the background colour fails layout', async () => {
    const film = withScene('Low contrast', {
      type: 'lowcontrast-scene',
      heading: 'Nearly invisible words',
    });
    const p = ws.project('lowcontrast', film, {
      'lowcontrast.ts': scenes.LOW_CONTRAST,
    });
    const {report} = await qa(p, PAGE);
    const gate = gateOf(report, 'layout');
    assert.equal(gate.status, 'FAIL');
    assert.match(detail(gate, /contrast/), /need at least 3:1/);
  });

  it('a label visible only mid-scene and placed off-frame fails layout once', async () => {
    const film = withScene('Mid label', {
      type: 'mid-label',
      duration: 8,
      heading: 'The main line',
      label: 'Hidden early label',
    });
    const p = ws.project('midlabel', film, {'mid-label.ts': scenes.MID_LABEL});
    const {report} = await qa(p, PAGE);
    const gate = gateOf(report, 'layout');
    assert.equal(gate.status, 'FAIL');
    const hits = gate.details.filter(d =>
      /Hidden early label.*safe area at the left edge/.test(d),
    );
    assert.equal(hits.length, 1, gate.details.join('\n'));
  });

  it('a spec with no scenes fails the load gate and says so', async () => {
    const p = ws.project('empty', {
      meta: {title: 'Empty', ...SMALL},
      scenes: [],
    });
    const {report, code} = await qa(p, PAGE);
    const gate = gateOf(report, 'load');
    assert.equal(gate.status, 'FAIL');
    assert.match(gate.details.join('\n'), /film\.scenes is empty/);
    assert.equal(code, 1);
  });

  it('an unknown scene type fails the load gate and lists the known types', async () => {
    const p = ws.project('unknown', {
      meta: {title: 'Unknown', ...SMALL},
      scenes: [{type: 'titel', duration: 3}],
    });
    const {report} = await qa(p, PAGE);
    assert.match(
      gateOf(report, 'load').details.join('\n'),
      /unknown type "titel"\. Known: .*title/,
    );
  });

  it('a clean film passes every page gate', async () => {
    const p = ws.project('clean', goodFilm(), {'ticker.ts': scenes.TICKER});
    const {report, code} = await qa(p, PAGE);
    for (const id of [
      'load',
      'determinism',
      'layout',
      'holds',
      'pacing',
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
