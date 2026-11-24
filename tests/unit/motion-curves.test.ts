/**
 * @fileoverview Springs and easing curves: overshoot, settling and exact end
 * points.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {EaseName} from '../../plugin/skills/video/scripts/runtime/easing.ts';
import {ease} from '../../plugin/skills/video/scripts/runtime/easing.ts';
import {
  spring,
  springSettle,
} from '../../plugin/skills/video/scripts/runtime/spring.ts';

function peak(zeta: number): number {
  let max = 0;
  for (let t = 0; t <= 2; t += 0.001) {
    max = Math.max(max, spring(t, {zeta, omega: 18}));
  }
  return max;
}

describe('springs', () => {
  it('a damping ratio of 1 never overshoots its target', () => {
    assert.ok(peak(1) <= 1 + 1e-9);
  });

  it('a damping ratio above 1 never overshoots either', () => {
    assert.ok(peak(2) <= 1 + 1e-9);
  });

  it('a damping ratio of 0.5 overshoots by more than 10%', () => {
    assert.ok(peak(0.5) > 1.1);
  });

  it('springs of 1, 0.5 and 2 all settle at 1', () => {
    for (const zeta of [1, 0.5, 2]) {
      const late = springSettle({zeta}) + 1;
      assert.ok(Math.abs(spring(late, {zeta}) - 1) < 1e-2, `zeta ${zeta}`);
    }
  });

  it('a spring has not started before time 0', () => {
    assert.equal(spring(-1), 0);
    assert.equal(spring(0), 0);
  });
});

describe('easing', () => {
  const names: EaseName[] = ['linear', 'out', 'in', 'inOut', 'pop'];

  for (const name of names) {
    it(`the ${name} curve is exactly 0 at the start and exactly 1 at the end`, () => {
      assert.equal(ease[name](0), 0);
      assert.equal(ease[name](1), 1);
    });
  }

  it('progress outside 0 to 1 does not leave the end points', () => {
    assert.equal(ease.out(-0.5), 0);
    assert.equal(ease.out(1.5), 1);
  });

  it('the pop curve overshoots 1 on the way, the out curve does not', () => {
    const top = (fn: (x: number) => number) =>
      Math.max(...Array.from({length: 101}, (_, i) => fn(i / 100)));
    assert.ok(top(ease.pop) > 1.01);
    assert.ok(top(ease.out) <= 1);
  });
});
