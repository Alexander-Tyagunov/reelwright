/**
 * @fileoverview Film timing: total length, lead, loops, cuts and the
 * rejection of scenes that are too short. Times are in seconds.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {TimelineMeta} from '../../plugin/skills/video/scripts/runtime/timeline.ts';
import {computeTimeline} from '../../plugin/skills/video/scripts/runtime/timeline.ts';

const meta: TimelineMeta = {
  transition: 'fade',
  transitionDuration: 0.45,
  loop: false,
  lead: 0.5,
  fps: 30,
};

const scenes = [
  {type: 'title', duration: 4},
  {type: 'bullets', duration: 5},
  {type: 'outro', duration: 3},
];

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
}

describe('timeline', () => {
  it('a film of 4, 5 and 3 s with 0.45 s fades and a 0.5 s lead lasts 10.6 s', () => {
    const t = computeTimeline(meta, scenes);
    close(t.duration, 12 - 2 * 0.45 - 0.5);
    assert.equal(t.frames, 318);
  });

  it('a loop has no lead and its last scene fades out', () => {
    const t = computeTimeline({...meta, loop: true}, scenes);
    assert.equal(t.lead, 0);
    assert.ok(t.slots[0]?.start === 0);
    assert.equal(t.slots[2]?.tout, 0.45);
    close(t.duration, 12 - 2 * 0.45);
  });

  it('the last scene of a film that is not a loop does not fade out', () => {
    const t = computeTimeline(meta, scenes);
    assert.equal(t.slots[2]?.tout, 0);
  });

  it('a loop with cuts still fades its last scene so the film can repeat', () => {
    const t = computeTimeline({...meta, loop: true, transition: 'cut'}, scenes);
    assert.ok((t.slots[2]?.tout ?? 0) > 0);
  });

  it('a cut has no overlap, so scenes follow each other exactly', () => {
    const t = computeTimeline({...meta, transition: 'cut', lead: 0}, scenes);
    assert.equal(t.overlap, 0);
    assert.equal(t.duration, 12);
    assert.deepEqual(
      t.slots.map(s => [Math.abs(s.start), s.tin, s.tout]),
      [
        [0, 0, 0],
        [4, 0, 0],
        [9, 0, 0],
      ],
    );
  });

  it('the lead never exceeds a third of a short first scene', () => {
    const t = computeTimeline(meta, [{type: 'title', duration: 1.2}]);
    close(t.lead, 0.4);
  });

  it('a scene shorter than its transition is rejected with the scene number', () => {
    const short = [scenes[0], {type: 'bullets', duration: 0.8}];
    assert.throws(
      () => computeTimeline(meta, short as typeof scenes),
      /scene 2 \(bullets\): duration 0\.8s is too short for a 0\.45s transition/,
    );
  });

  it('an unknown scene type is rejected and the known types are listed', () => {
    assert.throws(
      () =>
        computeTimeline(
          meta,
          [{type: 'titel', duration: 3}],
          ['title', 'bullets'],
        ),
      /unknown type "titel"\. Known: title, bullets/,
    );
  });

  it('a film with no scenes is rejected', () => {
    assert.throws(() => computeTimeline(meta, []), /film\.scenes is empty/);
  });

  it('a duration that lands on half a frame rounds up to the next frame', () => {
    const half = {...meta, loop: true, fps: 10};
    assert.equal(
      computeTimeline(half, [{type: 'title', duration: 1.05}]).frames,
      11,
    );
    assert.equal(
      computeTimeline(half, [{type: 'title', duration: 1.04}]).frames,
      10,
    );
  });
});
