/**
 * @fileoverview The plate contract: which frame a time shows, what a bad
 * `tracks.json` says, and how a label's times and track are resolved.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  bindPlate,
  parsePlateOptions,
} from '../../plugin/skills/video/scripts/runtime/scenes/lib/plate-spec.ts';
import type {SceneSpec} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {
  parsePlate,
  plateFrameAt,
  plateFramePath,
} from '../../plugin/skills/video/scripts/shared/plate.ts';
import {PLATE_FPS, tracksJson} from '../helpers/plate.ts';

const plate = parsePlate(tracksJson(1));
const scene = (extra: object): SceneSpec => ({
  type: 'plate',
  duration: 3,
  plate: 'plates/shot01/tracks.json',
  ...extra,
});

describe('which plate frame a time shows', () => {
  it('a scene that starts 1 s into the plate shows frame 15 at scene time 0', () => {
    assert.equal(plateFrameAt(plate, 0 + 1), 15);
  });

  it('a scene longer than the plate holds the last frame', () => {
    assert.equal(plateFrameAt(plate, 30), plate.frames - 1);
  });

  it('a time before the plate shows the first frame', () => {
    assert.equal(plateFrameAt(plate, -0.5), 0);
  });

  it('a 24 fps plate under a 30 fps film steps through frames 0, 0, 1, 2, 3 for film frames 0 to 4', () => {
    const shown = [0, 1, 2, 3, 4].map(k =>
      plateFrameAt({fps: 24, frames: 100}, k / 30),
    );
    assert.deepEqual(shown, [0, 0, 1, 2, 3]);
  });

  it('a time that lands on a frame boundary shows that frame, not the one before', () => {
    assert.equal(plateFrameAt({fps: 100, frames: 100}, 0.29), 29);
    assert.equal(plateFrameAt({fps: PLATE_FPS, frames: 45}, 0.2), 3);
  });

  it('the file of frame 0 carries the number in `first` and sits next to tracks.json', () => {
    const path = plateFramePath(plate, 'plates/shot01/tracks.json', 0);
    assert.equal(path, 'plates/shot01/frames/0001.jpg');
  });
});

describe('tracks.json checks', () => {
  it('an x array with one value too few names the track, the counts and the fix', () => {
    const json = tracksJson(1) as {points: {box: {x: number[]}}};
    json.points.box.x.pop();
    assert.throws(
      () => parsePlate(json),
      /points\.box\.x has 44 values, but frames is 45\. Export the tracks again/,
    );
  });

  it('a version this engine does not read is refused with the version it reads', () => {
    assert.throws(
      () => parsePlate({...(tracksJson(1) as object), version: 2}),
      /version 2 is not supported; this Reelwright reads version 1/,
    );
  });

  it('a frame pattern without an index is refused', () => {
    const json = {
      ...(tracksJson(1) as object),
      // biome-ignore lint/style/useNamingConvention: the file format's own key
      frame_pattern: 'frames/one.jpg',
    };
    assert.throws(
      () => parsePlate(json),
      /frame_pattern must hold one printf-style index/,
    );
  });
});

describe('plate scene fields', () => {
  it('a label on an unknown track lists the tracks the plate has', () => {
    const options = parsePlateOptions(
      scene({labels: [{track: 'opus', text: 'Opus'}]}),
    );
    assert.throws(
      () => bindPlate(options, plate, 3),
      /labels\[0\]\.track "opus" is not in tracks\.json\. Tracks: box/,
    );
  });

  it('a label that starts 0.3 s after the split event starts at 1.6333 s', () => {
    const labels = [
      {track: 'box', text: 'Box', from: {event: 'split', plus: 0.3}},
    ];
    const bound = bindPlate(parsePlateOptions(scene({labels})), plate, 3);
    assert.ok(Math.abs((bound.labels[0]?.from ?? 0) - (20 / 15 + 0.3)) < 1e-9);
  });

  it('an event time is counted from where the scene starts in the plate', () => {
    const labels = [{track: 'box', text: 'Box', from: {event: 'split'}}];
    const options = parsePlateOptions(scene({labels, start: 0.5}));
    const from = bindPlate(options, plate, 3).labels[0]?.from ?? 0;
    assert.ok(Math.abs(from - (20 / 15 - 0.5)) < 1e-9);
  });

  it('a label that names an event the plate does not have lists its events', () => {
    const labels = [{track: 'box', text: 'Box', from: {event: 'merge'}}];
    const options = parsePlateOptions(scene({labels}));
    assert.throws(
      () => bindPlate(options, plate, 3),
      /no event "merge"\. Events: split/,
    );
  });

  it('a label whose end is before its start is refused with both times', () => {
    const labels = [{track: 'box', text: 'Box', from: 2, to: 1}];
    const options = parsePlateOptions(scene({labels}));
    assert.throws(
      () => bindPlate(options, plate, 3),
      /labels\[0\]\.to \(1\.00 s\) must be after from \(2\.00 s\)/,
    );
  });

  it('a misspelt field is named as the likely typo when `plate` is missing', () => {
    assert.throws(
      () =>
        parsePlateOptions({
          type: 'plate',
          duration: 3,
          tracks: 'x.json',
        }),
      /plate must be a non-empty string; got undefined\. Not a field of this scene: tracks/,
    );
  });
});
