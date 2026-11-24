/**
 * @fileoverview The layout gate's rules on text boxes: safe area, clipping,
 * overlap and where in a scene it looks. Sizes are in pixels.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  findOverlaps,
  measureItem,
} from '../../plugin/skills/video/scripts/qa/layout-checks.ts';
import {sampleTimes} from '../../plugin/skills/video/scripts/qa/layout-times.ts';
import type {LayoutItem} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {scenesOf, textOf} from '../helpers/info.ts';

const spot = {width: 1280, height: 720, safe: 43.2, t: 2, scene: 1};

function item(extra: Partial<LayoutItem> = {}): LayoutItem {
  return {
    id: 1,
    parent: null,
    scene: 1,
    text: 'Faster exports',
    opacity: 1,
    x: 100,
    y: 100,
    w: 400,
    h: 60,
    fontSize: 48,
    color: 'rgb(240, 240, 240)',
    bg: 'rgb(15, 17, 21)',
    clipped: false,
    ...extra,
  };
}

const messages = (i: LayoutItem) =>
  measureItem(i, spot, 'scene 2 (title)').findings;

describe('layout checks', () => {
  it('a text 9 px past the left edge fails and names the edge and the overshoot', () => {
    const found = messages(item({x: 43.2 - 9}));
    assert.equal(found.length, 1);
    assert.equal(found[0]?.status, 'FAIL');
    assert.match(
      found[0]?.message ?? '',
      /9 px outside the safe area at the left edge/,
    );
  });

  it('a text half a pixel past the safe area is within tolerance', () => {
    assert.equal(messages(item({x: 43.2 - 0.5})).length, 0);
  });

  it('a text that runs past the bottom and right edges is reported for each edge', () => {
    const found = messages(item({x: 1000, y: 700, w: 400, h: 60}));
    assert.equal(found.length, 2);
  });

  it('a clipped text fails', () => {
    assert.match(
      messages(item({clipped: true}))[0]?.message ?? '',
      /clipped by its box/,
    );
  });

  it('type under 2.6% of the short side warns', () => {
    const found = messages(item({fontSize: 16}));
    assert.equal(found[0]?.status, 'WARN');
    assert.match(found[0]?.message ?? '', /font size 16 px is 2\.22%/);
  });

  it('low contrast fails below 3:1 and warns below 4.5:1', () => {
    assert.equal(messages(item({color: 'rgb(20, 23, 30)'}))[0]?.status, 'FAIL');
    assert.equal(
      messages(item({color: 'rgb(110, 110, 120)'}))[0]?.status,
      'WARN',
    );
  });

  it('the same text gets the same key at two times, so it is reported once', () => {
    const a = measureItem(item({x: 0}), {...spot, t: 1}, 'scene 2');
    const b = measureItem(item({x: 0}), {...spot, t: 2}, 'scene 2');
    assert.equal(a.findings[0]?.key, b.findings[0]?.key);
  });

  it('two unrelated texts stacked on each other overlap', () => {
    const a = item({id: 1});
    const b = item({id: 2, text: 'Second line', y: 110});
    assert.equal(findOverlaps([a, b], spot, 'scene 2').length, 1);
  });

  it('a text and the word spans inside it are not an overlap', () => {
    const parent = item({id: 1});
    const child = item({id: 2, parent: 1, text: 'Faster'});
    assert.equal(findOverlaps([parent, child], spot, 'scene 2').length, 0);
  });

  it('boxes that share 3% of the smaller box are accepted', () => {
    const a = item({id: 1, x: 100, y: 100, w: 100, h: 100});
    const b = item({id: 2, x: 197, y: 100, w: 100, h: 100});
    assert.equal(findOverlaps([a, b], spot, 'scene 2').length, 0);
  });
});

describe('layout sampling', () => {
  const scene = scenesOf([8])[0];

  it('a label that settles at 1 s is measured at 1.05 s as well as at the rest time', () => {
    assert.ok(scene);
    const texts = [textOf(0, {settle: 0.9}), textOf(0, {settle: 3.2})];
    assert.deepEqual(sampleTimes(scene, texts, 8), [4, 0.95, 3.25]);
  });

  it('two texts that settle together give one sample', () => {
    assert.ok(scene);
    const texts = [textOf(0, {settle: 1}), textOf(0, {settle: 1})];
    assert.deepEqual(sampleTimes(scene, texts, 8), [4, 1.05]);
  });

  it('texts of other scenes are not sampled', () => {
    assert.ok(scene);
    assert.deepEqual(sampleTimes(scene, [textOf(3, {settle: 1})], 8), [4]);
  });

  it('a scene with twenty texts is sampled at most 6 times, rest time first', () => {
    assert.ok(scene);
    const texts = Array.from({length: 20}, (_, i) =>
      textOf(0, {settle: 0.2 + i * 0.3}),
    );
    const times = sampleTimes(scene, texts, 8);
    assert.equal(times.length, 6);
    assert.equal(times[0], 4);
  });

  it('a settle time past the end of the film is brought back inside it', () => {
    assert.ok(scene);
    assert.deepEqual(sampleTimes(scene, [textOf(0, {settle: 20})], 8), [4, 8]);
  });
});
