/**
 * @fileoverview The synthesiser as a user meets it: the same spec gives the
 * same sound, the track is as long as the film, and no palette or cue gets
 * past the peak limit.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  dbToGain,
  peakOf,
  SAMPLE_RATE,
  samplesOf,
} from '../../plugin/skills/video/scripts/audio/buffer.ts';
import type {TrackPlan} from '../../plugin/skills/video/scripts/audio/compose.ts';
import {composeTrack} from '../../plugin/skills/video/scripts/audio/compose.ts';
import type {Cue} from '../../plugin/skills/video/scripts/audio/cues.ts';
import {planCues} from '../../plugin/skills/video/scripts/audio/cues.ts';
import {PALETTE_NAMES} from '../../plugin/skills/video/scripts/audio/palettes.ts';
import {resolveSound} from '../../plugin/skills/video/scripts/audio/sound-spec.ts';
import {encodeWav} from '../../plugin/skills/video/scripts/audio/wav.ts';
import type {SoundSpec} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {soundFilm} from '../helpers/sound.ts';

/** Seconds of the short film that most tests build. */
const SHORT_S = 24;

function planFor(sound: SoundSpec, duration = SHORT_S, cues?: Cue[]) {
  const s = resolveSound(sound);
  assert.ok(s, 'sound must be on');
  const key = {palette: s.palette, key: s.key};
  const info = soundFilm(3, (duration + 1) / 3);
  const plan: TrackPlan = {
    palette: s.palette,
    key: s.key,
    tempo: s.tempo,
    seed: s.seed,
    duration,
    bed: s.bed,
    intensity: s.intensity,
    cues: cues ?? planCues({...info, duration}, [], key),
  };
  return plan;
}

function rmsBetween(x: Float32Array, from: number, to: number): number {
  const a = samplesOf(from);
  const b = samplesOf(to);
  let sum = 0;
  for (let i = a; i < b; i++) {
    sum += (x[i] ?? 0) ** 2;
  }
  return Math.sqrt(sum / (b - a));
}

function hit(t: number, kind: 'hit' | 'boom'): Cue {
  return {t, kind, gain: 1, hz: 36.7, duration: null, source: 'spec'};
}

describe('generated sound is deterministic', () => {
  it('the same spec and seed give identical samples and identical WAV bytes', () => {
    const a = composeTrack(planFor({palette: 'epic', seed: 7}));
    const b = composeTrack(planFor({palette: 'epic', seed: 7}));
    assert.deepEqual(a.left, b.left);
    assert.deepEqual(a.right, b.right);
    assert.deepEqual(encodeWav(a), encodeWav(b));
  });

  it('another seed gives a different track', () => {
    const a = composeTrack(planFor({palette: 'calm', seed: 1}));
    const b = composeTrack(planFor({palette: 'calm', seed: 2}));
    assert.notDeepEqual(a.left, b.left);
  });

  it('the WAV is 48 kHz 16-bit stereo with four bytes per sample frame', () => {
    const bytes = encodeWav(composeTrack(planFor({}, 3)));
    const view = new DataView(bytes.buffer);
    assert.equal(view.getUint16(22, true), 2);
    assert.equal(view.getUint32(24, true), 48000);
    assert.equal(view.getUint16(34, true), 16);
    assert.equal(bytes.length, 44 + 3 * SAMPLE_RATE * 4);
  });
});

describe('track length and level', () => {
  it('the track is as long as the film to the sample, even for an odd length', () => {
    for (const seconds of [10, 12.3456, 31.0007]) {
      const track = composeTrack(planFor({palette: 'bright'}, seconds));
      assert.equal(track.left.length, samplesOf(seconds));
      assert.equal(track.right.length, samplesOf(seconds));
    }
  });

  for (const name of PALETTE_NAMES) {
    it(`${name}: the peak stays under -1 dBFS with every cue kind stacked at one moment`, () => {
      const kinds = ['tick', 'pop', 'whoosh', 'rise', 'chime', 'hit', 'boom'];
      const cues: Cue[] = [...kinds, 'sting'].map(kind => ({
        t: 10,
        kind: kind as Cue['kind'],
        gain: 1,
        hz: 220,
        duration: 2,
        source: 'spec',
      }));
      const track = composeTrack(planFor({palette: name}, SHORT_S, cues));
      assert.ok(peakOf(track) < dbToGain(-1), `peak ${peakOf(track)}`);
    });
  }

  it('a hit on top of a boom stays under the peak limit', () => {
    const cues = [hit(5, 'boom'), hit(5.02, 'hit'), hit(5.04, 'hit')];
    const track = composeTrack(planFor({palette: 'epic'}, 12, cues));
    assert.ok(peakOf(track) < dbToGain(-1));
  });

  it('the first and the last samples are silent', () => {
    const track = composeTrack(planFor({palette: 'tense'}));
    assert.equal(Math.abs(track.left[0] ?? 1), 0);
    assert.equal(Math.abs(track.right[track.right.length - 1] ?? 1), 0);
  });
});

describe('intensity', () => {
  it('rising intensity points make the end of the bed louder than the start', () => {
    const rising = [
      {at: 0, value: 0.05},
      {at: 20, value: 1},
    ];
    const plan = {...planFor({palette: 'bright', intensity: rising}), cues: []};
    const track = composeTrack(plan);
    const early = rmsBetween(track.left, 2, 5);
    const late = rmsBetween(track.left, 15, 18);
    assert.ok(late > early * 1.5, `early ${early}, late ${late}`);
  });

  it('falling intensity points make the end quieter than the start', () => {
    const falling = [
      {at: 0, value: 1},
      {at: 20, value: 0.05},
    ];
    const plan = {...planFor({palette: 'epic', intensity: falling}), cues: []};
    const track = composeTrack(plan);
    assert.ok(
      rmsBetween(track.left, 2, 5) > rmsBetween(track.left, 15, 18) * 1.5,
    );
  });
});

describe('meta.sound', () => {
  it('false and absent mean a silent film: no settings, no track', () => {
    assert.equal(resolveSound(false), null);
    assert.equal(resolveSound(undefined), null);
  });

  it('true means palette calm with bed and cues on', () => {
    const s = resolveSound(true);
    assert.equal(s?.palette.name, 'calm');
    assert.equal(s?.bed, true);
    assert.equal(s?.cues, true);
  });

  it('an unknown palette is refused and the message lists the palettes', () => {
    assert.throws(
      () => resolveSound({palette: 'jazzy'}),
      (e: Error) =>
        e.message.includes('"jazzy"') &&
        PALETTE_NAMES.every(name => e.message.includes(name)),
    );
  });

  it('a volume above 1, a tempo of 500 and a key of H are refused with the field name', () => {
    assert.throws(() => resolveSound({volume: 1.5}), /meta\.sound\.volume/);
    assert.throws(() => resolveSound({tempo: 500}), /meta\.sound\.tempo/);
    assert.throws(() => resolveSound({key: 'H'}), /meta\.sound\.key/);
  });

  it('an intensity point outside 0 to 1 is refused with its position', () => {
    assert.throws(
      () => resolveSound({intensity: [{at: 0, value: 2}]}),
      /meta\.sound\.intensity\[0\]\.value/,
    );
  });

  it('a misspelt field is named and the allowed fields are listed', () => {
    assert.throws(
      () => resolveSound({palete: 'calm'}),
      /"palete".*Allowed fields: palette/,
    );
  });

  it('bed and cues both off is refused because nothing would play', () => {
    assert.throws(
      () => resolveSound({bed: false, cues: false}),
      /nothing to play/,
    );
  });

  it('intensity as one number applies to the whole film', () => {
    assert.deepEqual(resolveSound({intensity: 0.3})?.intensity, [
      {at: 0, value: 0.3},
    ]);
  });
});
