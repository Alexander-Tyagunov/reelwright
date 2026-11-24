/**
 * @fileoverview Contrast ratios and colour parsing for the layout gate.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  contrastLevel,
  contrastRatio,
  parseColor,
} from '../../plugin/skills/video/scripts/qa/contrast.ts';

function ratio(fg: string, bg: string): number {
  const a = parseColor(fg);
  const b = parseColor(bg);
  assert.ok(a && b, 'colours must parse');
  return contrastRatio(a, b);
}

describe('contrast', () => {
  it('black on white is 21:1 and a colour on itself is 1:1', () => {
    assert.equal(Math.round(ratio('#000', '#fff') * 100) / 100, 21);
    assert.equal(ratio('#336699', '#336699'), 1);
  });

  it('#767676 on white is the darkest grey that reaches 4.5:1', () => {
    assert.ok(ratio('#767676', '#ffffff') >= 4.5);
    assert.ok(ratio('#777777', '#ffffff') < 4.5);
  });

  it('text almost the colour of the dark theme background is below 3:1 and fails', () => {
    const r = ratio('#14171E', '#0F1115');
    assert.ok(r < 3);
    assert.equal(contrastLevel(r), 'FAIL');
  });

  it('3.5:1 warns and 4.5:1 passes', () => {
    assert.equal(contrastLevel(3.5), 'WARN');
    assert.equal(contrastLevel(4.5), 'OK');
    assert.equal(contrastLevel(2.99), 'FAIL');
    assert.equal(contrastLevel(3), 'WARN');
  });

  it('colours as Chrome reports them are read in every form', () => {
    assert.deepEqual(parseColor('rgb(15, 17, 21)'), [15, 17, 21]);
    assert.deepEqual(parseColor('rgba(255, 255, 255, 0.6)'), [255, 255, 255]);
    assert.deepEqual(parseColor('#0F1115'), [15, 17, 21]);
    assert.deepEqual(parseColor('#fff'), [255, 255, 255]);
    assert.deepEqual(parseColor('color(srgb 1 0.5 0)'), [255, 127.5, 0]);
  });

  it('a colour name or an empty value is not guessed', () => {
    assert.equal(parseColor('transparent'), null);
    assert.equal(parseColor(''), null);
    assert.equal(parseColor(undefined), null);
  });
});
