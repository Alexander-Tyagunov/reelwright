/**
 * @fileoverview Reading holds: how long text must stay still, and what the
 * holds gate says when it does not. Times are in seconds.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {gateHolds} from '../../plugin/skills/video/scripts/qa/gates/holds.ts';
import {
  checkTime,
  readingHold,
} from '../../plugin/skills/video/scripts/runtime/holds.ts';
import {filmOf, textOf} from '../helpers/info.ts';

/** A title scene with a six-word title and an eight-word subtitle. */
function subtitle(duration: number) {
  return readingHold({
    settle: 1.6,
    duration,
    tout: 0.45,
    words: 8,
    readingRate: 0.3,
    noHold: false,
  });
}

describe('reading holds', () => {
  it('an eight-word subtitle needs 2.9 s and a six-word title 2.3 s', () => {
    assert.equal(subtitle(5).need, 2.9);
    const title = readingHold({
      settle: 1,
      duration: 5,
      tout: 0.45,
      words: 6,
      readingRate: 0.3,
      noHold: false,
    });
    assert.equal(title.need, 2.3);
  });

  it('a title scene with an eight-word subtitle needs about 4.9 s', () => {
    assert.ok(subtitle(4.9).hold >= subtitle(4.9).need);
    assert.ok(subtitle(4.7).hold < subtitle(4.7).need);
  });

  it('numbers marked as not read need no hold', () => {
    const counter = readingHold({
      settle: 2,
      duration: 4,
      tout: 0.45,
      words: 1,
      readingRate: 0.3,
      noHold: true,
    });
    assert.equal(counter.need, 0);
  });

  it('the rest time of a short scene stays before its outgoing fade', () => {
    assert.equal(checkTime(10, 3, 0.45, 2.9), 12.5);
  });

  it('a title with an eight-word subtitle in 3.5 s fails the holds gate', () => {
    const hold = subtitle(3.5).hold;
    const info = filmOf([3.5], {
      texts: [textOf(0, {words: 8, settle: 1.6, hold, need: 2.9})],
    });
    const gate = gateHolds(info);
    assert.equal(gate.status, 'FAIL');
    assert.match(gate.details[0] ?? '', /Lengthen the scene by 1\.34 s/);
  });

  it('a hold at 90% of what is needed warns instead of failing', () => {
    const info = filmOf([6], {texts: [textOf(0, {hold: 2.61, need: 2.9})]});
    assert.equal(gateHolds(info).status, 'WARN');
  });

  it('a film whose only number is marked as not read says there is no text to measure', () => {
    const info = filmOf([4], {texts: [textOf(0, {hold: 0.2, need: 0})]});
    const gate = gateHolds(info);
    assert.equal(gate.status, 'SKIP');
    assert.match(gate.summary, /^no text to measure/);
  });
});
