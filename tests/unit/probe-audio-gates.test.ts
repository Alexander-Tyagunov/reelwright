/**
 * @fileoverview The probe gate's comparison of a video with the film, and
 * the audio gate's loudness limits.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {gateAudio} from '../../plugin/skills/video/scripts/qa/gates/audio.ts';
import type {ProbeInput} from '../../plugin/skills/video/scripts/qa/gates/probe.ts';
import {gateProbe} from '../../plugin/skills/video/scripts/qa/gates/probe.ts';
import type {StreamFacts} from '../../plugin/skills/video/scripts/video/probe.ts';

function stream(extra: Partial<StreamFacts> = {}): StreamFacts {
  return {
    type: 'video',
    codec: 'h264',
    profile: 'High',
    pixFmt: 'yuv420p',
    width: 1920,
    height: 1080,
    rFrameRate: '30/1',
    avgFrameRate: '30/1',
    nbFrames: 150,
    nbReadPackets: 150,
    bitRate: null,
    sampleRate: 0,
    channels: 0,
    duration: 5,
    colorSpace: undefined,
    colorRange: undefined,
    ...extra,
  };
}

function input(extra: Partial<ProbeInput> = {}): ProbeInput {
  return {
    video: '/p/out/film.mp4',
    expected: {width: 1920, height: 1080, fps: 30, frames: 150},
    summary: null,
    currentHash: null,
    ...extra,
  };
}

describe('probe gate', () => {
  it('a video that matches the film passes', () => {
    assert.equal(gateProbe(input(), stream()).status, 'PASS');
  });

  it('a 1280x720 video checked against a 1920x1080 film fails with both sizes', () => {
    const gate = gateProbe(input(), stream({width: 1280, height: 720}));
    assert.equal(gate.status, 'FAIL');
    assert.ok(
      gate.details.some(d =>
        /size: expected 1920x1080, found 1280x720/.test(d),
      ),
    );
    assert.ok(gate.details.some(d => d.startsWith('hint:')));
  });

  it('a video one frame short fails on the frame count', () => {
    const gate = gateProbe(input(), stream({nbFrames: 149}));
    assert.ok(
      gate.details.some(d => /frame count: expected 150, found 149/.test(d)),
    );
  });

  it('a render made from another spec than the current one is older than the spec', () => {
    const summary = {specHash: 'aaa'};
    const gate = gateProbe(input({summary, currentHash: 'bbb'}), stream());
    assert.equal(gate.status, 'FAIL');
    assert.match(
      gate.details[0] ?? '',
      /older than the spec or runtime: render again/,
    );
  });

  it('a draft is compared with its own render summary, not with the film size', () => {
    const summary = {width: 480, height: 270, fps: 15, frames: 75};
    const draft = input({video: '/p/out/film-draft.mp4', summary});
    const small = stream({
      width: 480,
      height: 270,
      avgFrameRate: '15/1',
      nbFrames: 75,
    });
    assert.equal(gateProbe(draft, small).status, 'PASS');
  });

  it('a file with no video stream fails', () => {
    assert.equal(gateProbe(input(), undefined).status, 'FAIL');
  });

  it('a codec other than H.264 fails', () => {
    const gate = gateProbe(input(), stream({codec: 'vp9'}));
    assert.ok(
      gate.details.some(d => /codec: expected h264, found vp9/.test(d)),
    );
  });
});

describe('audio gate', () => {
  it('-14 LUFS with a true peak of -2 dBTP passes', () => {
    assert.equal(gateAudio({lufs: -14, truePeak: -2}).status, 'PASS');
  });

  it('-20 LUFS warns and says how much gain to add', () => {
    const gate = gateAudio({lufs: -20, truePeak: -3});
    assert.equal(gate.status, 'WARN');
    assert.match(gate.details[0] ?? '', /change gain by 4 dB/);
  });

  it('a true peak above -1 dBTP warns', () => {
    assert.equal(gateAudio({lufs: -14, truePeak: -0.2}).status, 'WARN');
  });

  it('silence cannot be measured and warns', () => {
    assert.equal(
      gateAudio({
        lufs: Number.NEGATIVE_INFINITY,
        truePeak: Number.NEGATIVE_INFINITY,
      }).status,
      'WARN',
    );
  });
});
