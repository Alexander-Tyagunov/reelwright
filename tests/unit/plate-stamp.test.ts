/**
 * @fileoverview Cache keys of plate scenes: a plate's fingerprint follows its
 * tracks.json and the size and modification time of its frame files, and a
 * changed plate does not change the stamp that every other scene shares.
 */
import assert from 'node:assert/strict';
import {utimesSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {plateFingerprint} from '../../plugin/skills/video/scripts/core/plate-stamp.ts';
import {projectStamp} from '../../plugin/skills/video/scripts/core/stamp.ts';
import type {FilmSpec} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {PLATE_FRAMES, tracksJson} from '../helpers/plate.ts';
import {put, removeDir, tempDir} from '../helpers/tmp.ts';

const film: FilmSpec = {
  scenes: [
    {type: 'title', duration: 3, title: 'Before'},
    {type: 'plate', duration: 3, plate: 'plates/shot01/tracks.json'},
  ],
};
const scene = film.scenes[1] as FilmSpec['scenes'][number];
const frame = (n: number) =>
  `plates/shot01/frames/${String(n).padStart(4, '0')}.jpg`;

let dir = '';
beforeEach(() => {
  dir = tempDir();
  put(dir, 'plates/shot01/tracks.json', JSON.stringify(tracksJson(1)));
  for (let n = 1; n <= PLATE_FRAMES; n++) {
    put(dir, frame(n), `frame ${n}`);
  }
});
afterEach(() => removeDir(dir));

describe('plate cache keys', () => {
  it('editing tracks.json changes the plate fingerprint', () => {
    const before = plateFingerprint(dir, scene);
    put(dir, 'plates/shot01/tracks.json', JSON.stringify(tracksJson(2)));
    assert.notEqual(plateFingerprint(dir, scene), before);
  });

  it('re-rendering one frame with a different size changes the plate fingerprint', () => {
    const before = plateFingerprint(dir, scene);
    put(dir, frame(7), 'a longer replacement frame');
    assert.notEqual(plateFingerprint(dir, scene), before);
  });

  it('touching a frame changes the plate fingerprint through its modification time', () => {
    const before = plateFingerprint(dir, scene);
    utimesSync(join(dir, frame(3)), new Date(2020, 1, 1), new Date(2020, 1, 1));
    assert.notEqual(plateFingerprint(dir, scene), before);
  });

  it('a file outside the plate leaves the fingerprint alone', () => {
    const before = plateFingerprint(dir, scene);
    put(dir, 'notes.txt', 'meeting notes');
    assert.equal(plateFingerprint(dir, scene), before);
  });

  it('changing a plate does not change the stamp the other scenes share', () => {
    const before = projectStamp(dir, film);
    put(dir, frame(7), 'a longer replacement frame');
    put(dir, 'plates/shot01/tracks.json', JSON.stringify(tracksJson(2)));
    assert.equal(projectStamp(dir, film), before);
  });

  it('a scene that is not a plate has no fingerprint', () => {
    assert.equal(plateFingerprint(dir, film.scenes[0] as typeof scene), null);
  });
});
