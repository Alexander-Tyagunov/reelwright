/**
 * @fileoverview Films that need a render: the video gates, and the verdicts
 * of `qa` with and without a video.
 */
import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {after, describe, it} from 'node:test';
import {missingTools, reel} from '../helpers/cli.ts';
import {builtInFilm, goodFilm, withScene} from '../helpers/films.ts';
import {
  detail,
  gateOf,
  qa,
  readReport,
  render,
  SMALL,
  workspace,
} from '../helpers/project.ts';
import * as scenes from '../helpers/scenes.ts';

const ws = workspace();
after(() => ws.dispose());
const skip = missingTools();

describe('video gates', {skip, timeout: 900_000}, () => {
  it('good: a clean film passes determinism, layout, holds, probe and motion', async () => {
    const p = ws.project('good', goodFilm(), {'ticker.ts': scenes.TICKER});
    await render(p);
    const {report, code} = await qa(p);
    for (const id of [
      'determinism',
      'layout',
      'holds',
      'probe',
      'motion',
    ] as const) {
      assert.equal(
        gateOf(report, id).status,
        'PASS',
        `${id}: ${gateOf(report, id).details.join('; ')}`,
      );
    }
    assert.notEqual(report.verdict, 'fail');
    assert.equal(code, 0);
  });

  it('qa --video checks a file with no spec: properties, motion and loudness only', async () => {
    const video = join(ws.root, 'good', 'out', 'film.mp4');
    const run = await reel(ws.root, ['qa', '--video', video, '--json']);
    const report = JSON.parse(run.output) as ReturnType<typeof readReport>;
    assert.deepEqual(
      report.gates.map(g => g.id),
      ['probe', 'motion', 'audio'],
    );
    assert.equal(report.film.spec, null);
    assert.equal(gateOf(report, 'probe').status, 'PASS');
    assert.equal(gateOf(report, 'audio').status, 'SKIP');
    assert.equal(run.code, 0);
    assert.equal(
      readReport(join(ws.root, 'good'), '-film').verdict,
      report.verdict,
    );
  });

  it('qa --video on a file that is not there fails the probe gate', async () => {
    const run = await reel(ws.root, [
      'qa',
      '--video',
      join(ws.root, 'nothing.mp4'),
      '--json',
    ]);
    assert.equal(run.code, 1);
    assert.match(run.output, /video not found/);
    assert.equal(
      existsSync(join(ws.root, 'qa-report-nothing.json')),
      false,
      'no report file for a video that is not there',
    );
  });

  it('frozen: a static scene of 6.5 s with a 4 s limit fails motion', async () => {
    const film = {
      meta: {title: 'Frozen', ...SMALL, maxHold: 4},
      scenes: [
        {type: 'title', duration: 3, title: 'Frozen frame test'},
        {type: 'static-text', duration: 6.5, heading: 'This text never moves'},
      ],
    };
    const p = ws.project('frozen', film, {'static.ts': scenes.STATIC});
    await render(p);
    const {report, code} = await qa(p);
    const gate = gateOf(report, 'motion');
    assert.equal(gate.status, 'FAIL');
    assert.match(detail(gate, /^FAIL freeze/), /nothing moves from/);
    assert.equal(code, 1);
  });

  it('seam: a loop whose last frame differs from the first fails motion', async () => {
    const film = withScene(
      'Seam',
      {type: 'seam-scene', heading: 'This one leaves a block behind'},
      {loop: true},
    );
    const p = ws.project('seam', film, {'seam.ts': scenes.SEAM});
    await render(p);
    const {report} = await qa(p);
    assert.match(
      detail(gateOf(report, 'motion'), /^FAIL loop seam/),
      /will visibly jump/,
    );
    assert.equal(gateOf(report, 'motion').status, 'FAIL');
  });

  it('loop-ok: built-in scenes that fade back to the background pass the seam', async () => {
    const p = ws.project('loopok', builtInFilm('Loop ok', {loop: true}));
    await render(p);
    const gate = gateOf((await qa(p)).report, 'motion');
    assert.equal(gate.status, 'PASS');
    assert.match(gate.summary, /seam/);
  });

  it('wrong-video: a 1280x720 video checked against a 1920x1080 film fails probe', async () => {
    const p = ws.project(
      'wrongvideo',
      builtInFilm('Wrong video', {width: 1920, height: 1080}),
    );
    await render(p, ['--size', '1280x720']);
    const {report, code} = await qa(
      p,
      ['--video', join(p.dir, 'out', 'film-1280x720.mp4')],
      '-film-1280x720',
    );
    assert.equal(
      existsSync(join(p.dir, 'out', 'qa-report.json')),
      false,
      'the master report is not written for another video file',
    );
    const gate = gateOf(report, 'probe');
    assert.equal(gate.status, 'FAIL');
    assert.match(
      detail(gate, /size/),
      /size: expected 1920x1080, found 1280x720/,
    );
    assert.equal(code, 1);
  });

  it('a render older than the spec fails the probe gate', async () => {
    const p = ws.project('stale', builtInFilm('Stale'));
    await render(p);
    const film = JSON.parse(readFileSync(p.spec, 'utf8'));
    film.scenes[1].heading = 'Edited after the render';
    writeFileSync(p.spec, JSON.stringify(film, null, 2));
    const {report, code} = await qa(p);
    const gate = gateOf(report, 'probe');
    assert.equal(gate.status, 'FAIL');
    assert.match(detail(gate, /older than the spec/), /render again/);
    assert.equal(code, 1);
  });

  it('qa without a render is incomplete and exits 1; --page-only passes', async () => {
    const p = ws.project('norender', builtInFilm('No render'));
    const full = await qa(p);
    assert.equal(full.report.verdict, 'incomplete');
    assert.equal(full.code, 1);
    assert.equal(gateOf(full.report, 'probe').status, 'SKIP');
    assert.equal(full.report.video, null);
    const page = await qa(p, ['--page-only']);
    assert.equal(page.report.verdict, 'pass');
    assert.equal(page.code, 0);
    assert.deepEqual(
      page.report.gates.map(g => g.id),
      ['load', 'determinism', 'layout', 'holds', 'pacing'],
    );
  });

  it('a draft render alone tells the user to render in full', async () => {
    const p = ws.project('draftonly', builtInFilm('Draft only'));
    await render(p, ['--draft']);
    const {report, code} = await qa(p);
    const gate = gateOf(report, 'probe');
    assert.equal(gate.status, 'SKIP');
    assert.match(gate.summary, /a draft is not checked/);
    assert.match(gate.summary, /--video out\/film-draft\.mp4/);
    assert.equal(report.verdict, 'incomplete');
    assert.equal(code, 1);
  });

  it('a custom scene that throws stops the render with the scene and the time and no stack', async () => {
    const film = withScene('Render throws', {
      type: 'throws-late',
      duration: 8,
      heading: 'This scene breaks',
    });
    const p = ws.project('renderthrows', film, {
      'throws.ts': scenes.THROWS_LATE,
    });
    const run = await reel(p.dir, ['render', p.spec]);
    assert.equal(run.code, 1);
    assert.match(
      run.output,
      /scene 2 \(throws-late\) threw at t=\d+\.\d\ds: boom at four seconds/,
    );
    assert.doesNotMatch(run.output, /\n\s+at .*[(:]\d+/, 'no stack lines');
  });

  it('--size checks another format and writes its own report file', async () => {
    const p = ws.project('sized', builtInFilm('Sized'));
    await render(p, ['--size', '1080x1350']);
    const {report, code} = await qa(p, ['--size', '1080x1350'], '-1080x1350');
    assert.equal(report.film.width, 1080);
    assert.equal(gateOf(report, 'probe').status, 'PASS');
    assert.equal(code, 0);
  });
});
