/**
 * @fileoverview Smoothing of a bobbing track so a label can glide, and the
 * fixed height of a label that follows only x.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {smoothTrack} from '../../plugin/skills/video/scripts/runtime/scenes/lib/plate-smooth.ts';
import type {BoundLabel} from '../../plugin/skills/video/scripts/runtime/scenes/lib/plate-spec.ts';
import {makePlacer} from '../../plugin/skills/video/scripts/runtime/scenes/lib/plate-track.ts';
import type {PlatePoint} from '../../plugin/skills/video/scripts/shared/plate.ts';
import {parsePlate} from '../../plugin/skills/video/scripts/shared/plate.ts';
import {tracksJson} from '../helpers/plate.ts';

const FPS = 15;
const N = 90;
const range = Array.from({length: N}, (_, i) => i);
/** A character that walks right while hopping twice a second. */
const bob: PlatePoint = {
  x: range.map(i => 0.2 + i * 0.005),
  y: range.map(i => 0.5 - 0.06 * Math.abs(Math.sin((Math.PI * i * 2) / FPS))),
  visible: range.map(() => 1),
};
const maxStep = (v: number[], a = 0, b = v.length) =>
  Math.max(...v.slice(a + 1, b).map((y, i) => Math.abs(y - (v[a + i] ?? 0))));

describe('smoothing a bobbing track', () => {
  it('a hopping point glides with far less vertical speed and no lag at either end', () => {
    const out = smoothTrack(bob, FPS, 0.6);
    assert.ok(maxStep(out.y) < maxStep(bob.y) / 4);
    for (const i of [0, 1, N - 2, N - 1]) {
      assert.ok(Math.abs((out.x[i] ?? 0) - (bob.x[i] ?? 0)) < 1e-6, `x[${i}]`);
    }
  });

  it('smooth 0 returns the track unchanged', () => {
    assert.deepEqual(smoothTrack(bob, FPS, 0), {x: bob.x, y: bob.y});
  });

  it('a gap where the point is hidden does not smear the two sides into each other', () => {
    const y = range.map(i => (i < 40 ? 0.2 : 0.8));
    const visible = range.map(i => (i >= 40 && i < 50 ? 0 : 1));
    const out = smoothTrack({x: y, y, visible}, FPS, 0.6);
    assert.ok(Math.abs((out.y[39] ?? 0) - 0.2) < 1e-6);
    assert.ok(Math.abs((out.y[50] ?? 0) - 0.8) < 1e-6);
    assert.equal(out.y[45], 0.8);
  });
});

describe('a label that follows only x', () => {
  const plate = parsePlate({
    ...(tracksJson(1) as object),
    frames: N,
    fps: FPS,
    points: {box: {...bob, depth: range.map(() => 8)}},
  });
  const l: BoundLabel = {
    track: 'box',
    text: 'Box',
    sub: '',
    from: 0,
    to: 6,
    side: 'top',
    offset: 4,
    smooth: 0.6,
    follow: 'x',
    leader: true,
    variant: 'tag',
  };
  const area = {x: 0, y: 0, w: 1000, h: 600};
  const geo = {plate, start: 0, drawn: area, area};
  const size = {x: 0, y: 0, w: 80, h: 30};

  it('keeps one height that stays clear of the point at its highest moment', () => {
    const {at} = makePlacer(geo, l, size, 20);
    const ys = range.map(f => at(f).box.y);
    assert.equal(new Set(ys).size, 1);
    const highest = Math.min(...bob.y) * area.h;
    assert.ok((ys[0] ?? 0) + size.h + 20 <= highest + 1e-6);
  });
});
