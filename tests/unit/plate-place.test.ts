/**
 * @fileoverview Where a label goes against a tracked point: each side,
 * `auto`, and clamping into the safe area. Frame pixels throughout.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  chooseSide,
  fitRect,
  leaderEnd,
  placeLabel,
} from '../../plugin/skills/video/scripts/runtime/scenes/lib/plate-place.ts';

const AREA = {x: 43.2, y: 43.2, w: 1193.6, h: 633.6};
const SIZE = {w: 100, h: 40};
const GAP = 30;
const AT = {x: 400, y: 300};

describe('label placement', () => {
  it('right puts the box one gap right of the point, centred on it', () => {
    const box = placeLabel(AT, SIZE, 'right', GAP, AREA);
    assert.deepEqual([box.x, box.y], [430, 280]);
  });

  it('left puts the box one gap left of the point', () => {
    assert.deepEqual(placeLabel(AT, SIZE, 'left', GAP, AREA).x, 270);
  });

  it('top puts the box above the point, centred on it', () => {
    const box = placeLabel(AT, SIZE, 'top', GAP, AREA);
    assert.deepEqual([box.x, box.y], [350, 230]);
  });

  it('bottom puts the box below the point', () => {
    assert.equal(placeLabel(AT, SIZE, 'bottom', GAP, AREA).y, 330);
  });

  it('auto picks left for a point near the right edge', () => {
    assert.equal(chooseSide({x: 1200, y: 360}, SIZE, GAP, AREA), 'left');
  });

  it('auto prefers right when both sides have room', () => {
    assert.equal(chooseSide({x: 640, y: 360}, SIZE, GAP, AREA), 'right');
  });

  it('auto picks top in a narrow frame with room only above the point', () => {
    const narrow = {x: 0, y: 0, w: 150, h: 700};
    assert.equal(chooseSide({x: 75, y: 600}, SIZE, GAP, narrow), 'top');
  });

  it('a box that would leave the safe area is moved back inside it', () => {
    const box = placeLabel({x: 1220, y: 40}, SIZE, 'right', GAP, AREA);
    assert.equal(box.x + box.w, AREA.x + AREA.w);
    assert.equal(box.y, AREA.y);
  });

  it('a clamped box leaves a leader line from its nearest edge to the point', () => {
    const point = {x: 1260, y: 300};
    const box = placeLabel(point, SIZE, 'right', GAP, AREA);
    const end = leaderEnd(box, point);
    assert.deepEqual(end, {x: box.x + box.w, y: 300});
  });

  it('a point inside the box has no leader line', () => {
    assert.equal(leaderEnd({x: 0, y: 0, w: 100, h: 40}, {x: 50, y: 20}), null);
  });
});

describe('where the plate is drawn', () => {
  it('cover on a square frame crops the sides of a wide picture equally', () => {
    const box = fitRect({w: 100, h: 100}, {w: 200, h: 100}, 'cover');
    assert.deepEqual(box, {x: -50, y: 0, w: 200, h: 100});
  });

  it('contain on a wide frame leaves bars above and below a square picture', () => {
    const box = fitRect({w: 200, h: 100}, {w: 50, h: 50}, 'contain');
    assert.deepEqual(box, {x: 50, y: 0, w: 100, h: 100});
  });
});
