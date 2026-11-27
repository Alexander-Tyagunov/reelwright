/**
 * @fileoverview The brightness check of `reel plate` on frames of the first
 * film's plate C3, where 12 frames rendered with a black foreground, and on
 * its intro, where a lamp is switched off on purpose.
 */
import assert from 'node:assert/strict';
import {copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, it} from 'node:test';
import {run} from '../../plugin/skills/video/scripts/commands/plate.ts';
import {which} from '../../plugin/skills/video/scripts/core/process.ts';
import {findBrightnessRuns} from '../../plugin/skills/video/scripts/qa/brightness-runs.ts';
import {plateRuns} from '../../plugin/skills/video/scripts/qa/plate-brightness.ts';
import {frameBrightness} from '../../plugin/skills/video/scripts/video/brightness.ts';

const PLATES = join(
  import.meta.dirname,
  '..',
  'fixtures',
  'first-film',
  'plates',
);

function runsOf(plate: string) {
  const pattern = join(PLATES, plate, 'frames', '%04d.jpg');
  return frameBrightness(['-start_number', '1', '-i', pattern]).then(plateRuns);
}

const NO_FFMPEG = which('ffmpeg') ? false : 'skipped: ffmpeg is not installed';

describe('plate brightness on frames of the first film', {
  skip: NO_FFMPEG,
}, () => {
  it('C3 with black-foreground frames lists the runs 13-19 and 33-37, and no others', async () => {
    const runs = await runsOf('dropout');
    assert.deepEqual(
      runs.map(r => [r.first + 1, r.last + 1]),
      [
        [13, 19],
        [33, 37],
      ],
    );
  });

  it('the same plate with its good frames lists nothing', async () => {
    assert.deepEqual(await runsOf('clean'), []);
  });

  it('the intro, where a lamp goes out and the picture stays dark, lists nothing', async () => {
    assert.deepEqual(await runsOf('lamp-off'), []);
  });
});

describe('plate brightness rule', () => {
  it('the last 3 frames gone black are a run at the end', () => {
    const runs = findBrightnessRuns([27, 28, 27, 29, 28, 27, 2, 2, 2]);
    assert.deepEqual(
      runs.map(r => [r.first, r.last, r.edge]),
      [[6, 8, 'end']],
    );
  });

  it('the first 2 frames gone black are a run at the start', () => {
    const runs = findBrightnessRuns([2, 2, 27, 28, 27, 29, 28]);
    assert.deepEqual(
      runs.map(r => [r.first, r.last, r.edge]),
      [[0, 1, 'start']],
    );
  });

  it('a lamp that goes out at the end and leaves a dim picture is not a run', () => {
    assert.deepEqual(
      findBrightnessRuns([57, 57.8, 58, 57.2, 57.8, 17.4, 14.3, 20, 20.2]),
      [],
    );
  });

  it('a light that comes on after 12 dark frames at the start is not a run', () => {
    const dark = Array.from({length: 12}, () => 15);
    assert.deepEqual(findBrightnessRuns([...dark, 55, 82, 95, 92, 93]), []);
  });

  it('a steady fade from black is not a run', () => {
    assert.deepEqual(findBrightnessRuns([0, 5, 10, 20, 30, 40, 50, 60]), []);
  });

  it('a one-frame white flash between two equal frames is a run', () => {
    const runs = findBrightnessRuns([30, 30, 70, 30, 30]);
    assert.deepEqual(
      runs.map(r => [r.first, r.last]),
      [[2, 2]],
    );
  });
});

describe('reel plate on a vertical plate that holds only a three-pose check', () => {
  it('reports the missing frame files as ranges and does not crash', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reel-partial-'));
    const plate = join(dir, 'plates', 'clean@9x16');
    mkdirSync(join(plate, 'frames'), {recursive: true});
    copyFileSync(
      join(PLATES, 'clean', 'tracks.json'),
      join(plate, 'tracks.json'),
    );
    for (const n of ['0001', '0013', '0038']) {
      const name = join('frames', `${n}.jpg`);
      copyFileSync(join(PLATES, 'clean', name), join(plate, name));
    }
    const out = console.log;
    console.log = () => {};
    try {
      await assert.rejects(
        run({positional: [join(plate, 'tracks.json')], flags: {}}),
        /35 of 38 frame files are missing \(3 present.*frames 2-12, 14-37/s,
      );
    } finally {
      console.log = out;
      rmSync(dir, {recursive: true, force: true});
    }
  });
});

describe('reel plate on a folder whose name holds a percent sign', {
  skip: NO_FFMPEG,
}, () => {
  it('reads the frames of "one 100%" instead of failing in ffmpeg', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'reel-pct-')), 'one 100%');
    cpSync(join(PLATES, 'clean'), dir, {recursive: true});
    const out = console.log;
    console.log = () => {};
    try {
      assert.equal(
        await run({positional: [join(dir, 'tracks.json')], flags: {}}),
        0,
      );
    } finally {
      console.log = out;
    }
  });
});
