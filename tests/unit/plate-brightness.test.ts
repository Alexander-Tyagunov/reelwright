/**
 * @fileoverview The brightness check of `reel plate` on frames of the first
 * film's plate C3, where 12 frames rendered with a black foreground, and on
 * its intro, where a lamp is switched off on purpose.
 */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {describe, it} from 'node:test';
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

describe('plate brightness on frames of the first film', () => {
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
