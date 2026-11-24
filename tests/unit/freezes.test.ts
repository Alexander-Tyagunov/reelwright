/**
 * @fileoverview Freeze, dead-scene, abrupt-change and loop-seam detection on
 * synthetic motion signals at 30 fps.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  freezeLimit,
  stillMask,
  stillRuns,
  toFreezes,
} from '../../plugin/skills/video/scripts/qa/freezes.ts';
import {gateMotion} from '../../plugin/skills/video/scripts/qa/gates/motion.ts';
import {scenesOf, textOf} from '../helpers/info.ts';
import {decoded, signal} from '../helpers/signal.ts';

const FPS = 30;

function film(durations: number[], extra: object = {}) {
  return {
    scenes: scenesOf(durations),
    texts: [],
    loop: false,
    maxHold: 4,
    ...extra,
  };
}

const fails = (details: string[], word: string) =>
  details.filter(d => d.startsWith('FAIL') && d.includes(word));

describe('freeze detection', () => {
  it('a 6 s still stretch fails against a 4 s limit', () => {
    const diffs = signal([30, 2], [180, 0], [30, 2]);
    const gate = gateMotion(film([8]), decoded(diffs), FPS);
    assert.equal(gate.status, 'FAIL');
    assert.equal(gate.freezes?.[0]?.seconds, 6);
    assert.match(
      fails(gate.details, 'freeze')[0] ?? '',
      /longer than the limit of 4 s/,
    );
  });

  it('a still stretch of 3.5 s is reported as information, not a failure', () => {
    const diffs = signal([30, 2], [105, 0], [30, 2]);
    const gate = gateMotion(film([5.5]), decoded(diffs), FPS);
    assert.equal(gate.status, 'PASS');
    assert.ok(gate.details.some(d => d.startsWith('info freeze')));
  });

  it('a keyframe spike inside a still stretch does not split it', () => {
    const diffs = signal([30, 2], [89, 0], [1, 0.05], [90, 0], [30, 2]);
    const runs = stillRuns(stillMask(diffs));
    assert.equal(toFreezes(runs, FPS).length, 1);
    assert.equal(toFreezes(runs, FPS)[0]?.seconds, 6);
  });

  it('real motion in the middle of a still stretch does split it', () => {
    const diffs = signal([90, 0], [3, 1.5], [90, 0]);
    assert.equal(toFreezes(stillRuns(stillMask(diffs)), FPS).length, 2);
  });

  it('a scene with a 5 s reading hold may stay still for the hold plus 1.5 s', () => {
    const diffs = signal([30, 2], [180, 0], [30, 2]);
    const reading = film([8], {texts: [textOf(0, {need: 5})]});
    assert.equal(freezeLimit(4, 5), 6.5);
    assert.equal(gateMotion(reading, decoded(diffs), FPS).status, 'PASS');
  });

  it('a scene with no motion in its first 1.5 s is dead even when the freeze is allowed', () => {
    const diffs = signal([89, 2], [106, 0]);
    const gate = gateMotion(film([3, 3.5]), decoded(diffs), FPS);
    assert.equal(gate.status, 'FAIL');
    assert.equal(fails(gate.details, 'freeze').length, 0);
    assert.match(
      fails(gate.details, 'scene 2')[0] ?? '',
      /no motion in its first 1\.5 s/,
    );
  });

  it('a full-frame jump in the middle of a scene warns of a glitch', () => {
    const diffs = signal([60, 2], [1, 60], [60, 2]);
    const gate = gateMotion(film([4]), decoded(diffs), FPS);
    assert.equal(gate.status, 'WARN');
    assert.match(gate.details[0] ?? '', /abrupt change at 2\.03 s/);
  });

  it('a full-frame jump at a scene boundary is accepted', () => {
    const diffs = signal([90, 2], [1, 60], [89, 2]);
    assert.equal(gateMotion(film([3, 3]), decoded(diffs), FPS).status, 'PASS');
  });
});

describe('loop seam', () => {
  const diffs = signal([60, 1], [60, 1]);

  it('a loop whose last frame differs from the first by 20 levels fails', () => {
    const gate = gateMotion(
      film([2, 2], {loop: true}),
      decoded(diffs, 20),
      FPS,
    );
    assert.equal(gate.status, 'FAIL');
    assert.match(
      fails(gate.details, 'loop seam')[0] ?? '',
      /will visibly jump/,
    );
  });

  it('a loop whose last frame is close to the first passes', () => {
    const gate = gateMotion(
      film([2, 2], {loop: true}),
      decoded(diffs, 0.4),
      FPS,
    );
    assert.equal(gate.status, 'PASS');
    assert.match(gate.summary, /seam 0\.4 vs limit 1\.55/);
  });

  it('a film that is not a loop is not judged on its seam', () => {
    assert.equal(
      gateMotion(film([2, 2]), decoded(diffs, 20), FPS).status,
      'PASS',
    );
  });
});
