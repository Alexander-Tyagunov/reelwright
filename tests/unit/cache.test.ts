/**
 * @fileoverview Render cache keys: a stamp changes when a file the film uses
 * changes and stays the same when an unrelated file changes.
 */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {
  projectStamp,
  specHash,
} from '../../plugin/skills/video/scripts/core/stamp.ts';
import type {FilmSpec} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {put, removeDir, tempDir} from '../helpers/tmp.ts';

const film: FilmSpec = {
  customScenes: ['scenes/ticker.ts'],
  scenes: [
    {type: 'title', duration: 3, logo: 'assets/logo.svg'},
    {
      type: 'image',
      duration: 4,
      src: 'shots/one.png',
      link: 'https://example.com/a.png',
    },
  ],
};

let dir = '';
let specPath = '';
beforeEach(() => {
  dir = tempDir();
  put(dir, 'assets/logo.svg', '<svg/>');
  put(dir, 'shots/one.png', 'png-one');
  put(dir, 'scenes/ticker.ts', 'Reel.scene("ticker", () => undefined);');
  put(dir, 'notes.txt', 'meeting notes');
  specPath = put(dir, 'film.json', JSON.stringify(film));
});
afterEach(() => removeDir(dir));

describe('cache invalidation', () => {
  it('editing an image the spec names changes the stamp', () => {
    const before = projectStamp(dir, film);
    put(dir, 'shots/one.png', 'png-two');
    assert.notEqual(projectStamp(dir, film), before);
  });

  it('editing a file in the assets folder changes the stamp', () => {
    const before = projectStamp(dir, film);
    put(dir, 'assets/logo.svg', '<svg width="2"/>');
    assert.notEqual(projectStamp(dir, film), before);
  });

  it('editing a custom scene file changes the stamp', () => {
    const before = projectStamp(dir, film);
    put(
      dir,
      'scenes/ticker.ts',
      'Reel.scene("ticker", () => undefined); // v2',
    );
    assert.notEqual(projectStamp(dir, film), before);
  });

  it('adding a font or asset file changes the stamp', () => {
    const before = projectStamp(dir, film);
    put(dir, 'fonts/brand.woff2', 'font');
    assert.notEqual(projectStamp(dir, film), before);
  });

  it('editing an unrelated file leaves the stamp alone', () => {
    const before = projectStamp(dir, film);
    put(dir, 'notes.txt', 'different notes');
    put(dir, 'README.md', 'new file');
    assert.equal(projectStamp(dir, film), before);
  });

  it('a file outside the project folder that the spec names is not tracked', () => {
    put(dir, '../outside-cache-test.png', 'one');
    const outside = {
      ...film,
      scenes: [{type: 'image', duration: 3, src: '../outside-cache-test.png'}],
    };
    const before = projectStamp(dir, outside);
    put(dir, '../outside-cache-test.png', 'two');
    assert.equal(projectStamp(dir, outside), before);
    removeDir(join(dir, '../outside-cache-test.png'));
  });

  it('a spec hash changes with an asset and with the spec, not with notes', () => {
    const base = specHash(specPath, dir, film);
    put(dir, 'notes.txt', 'other');
    assert.equal(specHash(specPath, dir, film), base);
    put(dir, 'shots/one.png', 'changed');
    const afterAsset = specHash(specPath, dir, film);
    assert.notEqual(afterAsset, base);
    put(dir, 'film.json', JSON.stringify({...film, meta: {fps: 24}}));
    assert.notEqual(specHash(specPath, dir, film), afterAsset);
  });
});
