/**
 * @fileoverview The field checks that built-in scenes run when they mount:
 * what a failure says about a wrong or misspelt field.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {sceneChecks} from '../../plugin/skills/video/scripts/runtime/scenes/lib/validate.ts';

const FIELDS = ['label', 'value', 'items'];

describe('scene field checks', () => {
  it('a metric with no value names the field, what was found and the fields', () => {
    const spec = {type: 'metric', duration: 5, metrics: [{value: 42}]};
    const check = sceneChecks(spec, FIELDS);
    assert.throws(
      () => check.number('value', undefined),
      /value must be a number; got undefined\. Not a field of this scene: metrics\. Fields: label, value, items/,
    );
  });

  it('a value written as text is rejected with the text shown', () => {
    const check = sceneChecks({type: 'metric', duration: 5}, FIELDS);
    assert.throws(() => check.number('value', '42'), /got "42"/);
  });

  it('NaN is not a number', () => {
    const check = sceneChecks({type: 'metric', duration: 5}, FIELDS);
    assert.throws(() => check.number('value', Number.NaN), /got NaN/);
  });

  it('a list with too many entries says how many are allowed', () => {
    const check = sceneChecks({type: 'metric', duration: 5}, FIELDS);
    assert.throws(
      () => check.list('items', [1, 2, 3, 4], 1, 3),
      /items must be a list of 1 to 3 entries/,
    );
  });
});
