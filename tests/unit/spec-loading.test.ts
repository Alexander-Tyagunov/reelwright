/**
 * @fileoverview What a user sees when the film spec cannot be loaded.
 */
import assert from 'node:assert/strict';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {UserError} from '../../plugin/skills/video/scripts/core/errors.ts';
import {loadSpec} from '../../plugin/skills/video/scripts/core/spec.ts';
import {put, removeDir, tempDir} from '../helpers/tmp.ts';

let dir = '';
beforeEach(() => {
  dir = tempDir();
});
afterEach(() => removeDir(dir));

function message(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof UserError, 'must be a UserError');
    return e.message;
  }
  return assert.fail('expected an error');
}

describe('loading a film spec', () => {
  it('a missing file is named by its full path', () => {
    assert.match(
      message(() => loadSpec(`${dir}/nope.json`)),
      /film spec not found: .*nope\.json/,
    );
  });

  it('no path at all asks for one', () => {
    assert.match(
      message(() => loadSpec(undefined)),
      /missing film spec path/,
    );
  });

  it('invalid JSON says so and names the file', () => {
    const path = put(dir, 'film.json', '{"scenes": [');
    assert.match(
      message(() => loadSpec(path)),
      /not valid JSON \(.*film\.json\)/,
    );
  });

  it('a JSON list instead of an object is rejected', () => {
    const path = put(dir, 'film.json', '[]');
    assert.match(
      message(() => loadSpec(path)),
      /must be a JSON object/,
    );
  });

  it('a valid spec gives its folder and its content', () => {
    const path = put(
      dir,
      'film.json',
      '{"scenes": [{"type": "title", "duration": 3}]}',
    );
    const spec = loadSpec(path);
    assert.equal(spec.dir, dir);
    assert.equal(spec.film.scenes.length, 1);
  });
});
