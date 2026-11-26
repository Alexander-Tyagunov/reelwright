/**
 * @fileoverview Reading time of a label that moves with the picture: it is
 * readable while it moves slower than the limit, and the holds gate warns
 * when it is faster for most of its time on screen.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {gateHolds} from '../../plugin/skills/video/scripts/qa/gates/holds.ts';
import {
  fastShare,
  longestSlowRun,
} from '../../plugin/skills/video/scripts/qa/label-reading.ts';
import {LABEL_MAX_SPEED} from '../../plugin/skills/video/scripts/qa/thresholds.ts';
import type {TextMotion} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {filmOf, textOf} from '../helpers/info.ts';

const STEP = 0.1;
const SLOW = LABEL_MAX_SPEED / 2;
const FAST = LABEL_MAX_SPEED * 3;
const motion = (speed: Array<number | null>): TextMotion => ({
  at: 1,
  step: STEP,
  speed,
});
const repeat = (v: number | null, n: number) => Array<number | null>(n).fill(v);

function holdsFor(speed: Array<number | null>) {
  const text = textOf(0, {
    text: 'Opus',
    words: 1,
    need: 0.8,
    hold: speed.length * STEP,
    motion: motion(speed),
  });
  return gateHolds(filmOf([4], {texts: [text]}));
}

describe('reading a label that moves', () => {
  it('a label drifting slowly for 2 s counts as readable for 2 s', () => {
    assert.ok(
      Math.abs(longestSlowRun(motion(repeat(SLOW, 20)), LABEL_MAX_SPEED) - 2) <
        1e-9,
    );
    assert.equal(holdsFor(repeat(SLOW, 20)).status, 'PASS');
  });

  it('a label that is hidden for a moment is readable only for its longer stretch', () => {
    const speed = [...repeat(SLOW, 12), null, ...repeat(SLOW, 5)];
    assert.ok(
      Math.abs(longestSlowRun(motion(speed), LABEL_MAX_SPEED) - 1.2) < 1e-9,
    );
  });

  it('a label that is fast for its whole time warns that it is hard to read and fails its hold', () => {
    const gate = holdsFor(repeat(FAST, 20));
    assert.equal(gate.status, 'FAIL');
    assert.ok(
      gate.details.some(d =>
        /moves faster than 6% of the short side per second for 100%/.test(d),
      ),
    );
  });

  it('a label that is fast for a third of its time and slow after it passes without a speed warning', () => {
    const speed = [...repeat(FAST, 7), ...repeat(SLOW, 13)];
    assert.ok(fastShare(motion(speed), LABEL_MAX_SPEED) < 0.5);
    const gate = holdsFor(speed);
    assert.equal(gate.status, 'PASS');
  });

  it('a label that is fast most of the time warns even when a slow stretch is long enough to read', () => {
    const speed = [...repeat(SLOW, 9), ...repeat(FAST, 20)];
    const gate = holdsFor(speed);
    assert.equal(gate.status, 'WARN');
    assert.ok(gate.details.some(d => /moves faster/.test(d)));
  });
});
