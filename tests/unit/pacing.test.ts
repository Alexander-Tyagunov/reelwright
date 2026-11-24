/**
 * @fileoverview The pacing gate's blank-frame rule: a film that loops is
 * blank at both ends by design. Spreads are grey levels of a thumbnail.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {blankFrameWarnings} from '../../plugin/skills/video/scripts/qa/gates/pacing.ts';

const blank = {first: 0, last: 0, lastAt: 9.97};

describe('pacing blank frames', () => {
  it('a film that does not loop warns about a blank first and last frame', () => {
    const warnings = blankFrameWarnings(false, blank);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0] ?? '', /frame 0 is blank/);
    assert.match(warnings[1] ?? '', /last frame \(t=9\.97s\) is blank/);
  });

  it('a looping film does not warn about blank first and last frames', () => {
    assert.deepEqual(blankFrameWarnings(true, blank), []);
  });

  it('a film whose first and last frames show something does not warn', () => {
    const shown = {first: 40, last: 35, lastAt: 9.97};
    assert.deepEqual(blankFrameWarnings(false, shown), []);
  });
});
