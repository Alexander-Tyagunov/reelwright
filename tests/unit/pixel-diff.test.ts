/**
 * @fileoverview Pixel comparison for the determinism gate: anti-aliasing
 * noise is ignored, a frame that depends on history is not.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {pickTimes} from '../../plugin/skills/video/scripts/qa/gates/determinism.ts';
import {compareRgb} from '../../plugin/skills/video/scripts/qa/pixel-diff.ts';
import {filmOf} from '../helpers/info.ts';

const grey = (pixels: number) => new Uint8Array(pixels * 3).fill(100);

function shifted(base: Uint8Array, pixels: number, by: number): Uint8Array {
  const copy = Uint8Array.from(base);
  for (let i = 0; i < pixels; i++) {
    copy[i * 3] = 100 + by;
  }
  return copy;
}

describe('pixel comparison', () => {
  it('200 pixels that differ by 5 levels are anti-aliasing noise and do not count', () => {
    const a = grey(10_000);
    const d = compareRgb(a, shifted(a, 200, 5));
    assert.equal(d.pixels, 0);
    assert.equal(d.max, 5);
  });

  it('100 pixels that differ by 40 levels count', () => {
    const a = grey(10_000);
    assert.equal(compareRgb(a, shifted(a, 100, 40)).pixels, 100);
  });

  it('images of different sizes never match', () => {
    assert.equal(
      compareRgb(grey(10), grey(12)).pixels,
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('determinism sampling', () => {
  it('a film of 8 scenes is sampled at 6 moments spread from first to last scene', () => {
    const info = filmOf([4, 4, 4, 4, 4, 4, 4, 4]);
    const times = pickTimes(info);
    assert.equal(times.length, 6);
    assert.equal(times[0], info.scenes[0]?.check);
    assert.equal(times[5], info.scenes[7]?.check);
  });

  it('a film of 2 scenes is sampled at both rest times, then 0.2 s into each scene', () => {
    const info = filmOf([4, 5]);
    assert.deepEqual(pickTimes(info), [2, 6.5, 4.2, 0.2]);
  });
});
