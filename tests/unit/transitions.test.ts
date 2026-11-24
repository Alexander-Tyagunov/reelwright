/**
 * @fileoverview Scene transitions: the outgoing scene is gone before the
 * incoming one appears, so text never overlaps text.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {layerLook} from '../../plugin/skills/video/scripts/runtime/transitions.ts';
import type {TransitionKind} from '../../plugin/skills/video/scripts/shared/contract.ts';

const DURATION = 5;
const TRANSITION = 0.45;

function pair(kind: TransitionKind, t: number) {
  const outgoing = layerLook(t, {
    duration: DURATION,
    tin: 0,
    tout: TRANSITION,
    kind,
  });
  const incoming = layerLook(t - (DURATION - TRANSITION), {
    duration: 4,
    tin: TRANSITION,
    tout: 0,
    kind,
  });
  return {outgoing, incoming};
}

describe('transitions', () => {
  for (const kind of ['fade', 'slide'] as const) {
    it(`a ${kind} clears the outgoing scene before the incoming one appears`, () => {
      for (let t = 4; t <= DURATION + 0.5; t += 0.005) {
        const {outgoing, incoming} = pair(kind, t);
        assert.ok(
          outgoing.opacity === 0 || incoming.opacity === 0,
          `both visible at ${t}`,
        );
      }
    });
  }

  it('a scene is fully visible between its transitions', () => {
    const look = layerLook(2, {
      duration: 5,
      tin: 0.45,
      tout: 0.45,
      kind: 'fade',
    });
    assert.deepEqual(look, {opacity: 1, dx: 0});
  });

  it('a slide moves the outgoing scene left and brings the next in from the right', () => {
    const out = pair('slide', 4.7).outgoing;
    const inc = pair('slide', 4.6).incoming;
    assert.ok(out.dx < 0);
    assert.ok(inc.dx > 0);
  });

  it('a cut leaves the layer untouched', () => {
    const look = layerLook(0, {duration: 5, tin: 0, tout: 0, kind: 'cut'});
    assert.deepEqual(look, {opacity: 1, dx: 0});
  });
});
