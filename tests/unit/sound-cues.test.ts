/**
 * @fileoverview Which cues a film gets: derived from its scene changes and
 * text, explicit ones on any scene (a plate scene too), and the rules that
 * keep a list of rows from machine-gunning.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {resolveAuto} from '../../plugin/skills/video/scripts/audio/auto-cues.ts';
import {
  MIN_CUE_GAP_S,
  planCues,
} from '../../plugin/skills/video/scripts/audio/cues.ts';
import {PALETTES} from '../../plugin/skills/video/scripts/audio/palettes.ts';
import {pitchClass} from '../../plugin/skills/video/scripts/audio/scale.ts';
import {sceneCues} from '../../plugin/skills/video/scripts/audio/scene-cues.ts';
import type {SceneSpec} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {FIXTURE_OVERLAP, soundFilm} from '../helpers/sound.ts';

const calm = PALETTES.calm;
assert.ok(calm);
const KEY = {palette: calm, key: calm.key};
const info = soundFilm();
const plain = info.scenes.map((): SceneSpec => ({type: 'title', duration: 9}));

describe('cues derived from the film', () => {
  const cues = planCues(info, plain, KEY);

  it('a soft whoosh is centred on each scene change', () => {
    const whooshes = cues.filter(c => c.kind === 'whoosh').map(c => c.t);
    const centres = info.scenes
      .slice(1)
      .map(s => s.start + FIXTURE_OVERLAP / 2);
    assert.equal(whooshes.length, centres.length);
    whooshes.forEach((t, i) => {
      assert.ok(Math.abs(t - (centres[i] ?? 0)) < 1e-9);
    });
  });

  it('a tick lands where a text block settles', () => {
    const second = info.scenes[1];
    assert.ok(second);
    const ticks = cues.filter(c => c.kind === 'tick');
    assert.ok(ticks.some(c => Math.abs(c.t - (second.start + 0.6)) < 1e-9));
    assert.ok(ticks.some(c => Math.abs(c.t - (second.start + 1.2)) < 1e-9));
  });

  it('two ticks closer than the density limit give one tick, the earlier', () => {
    const second = info.scenes[1];
    assert.ok(second);
    const near = cues.filter(
      c => c.kind === 'tick' && Math.abs(c.t - (second.start + 1.25)) < 0.01,
    );
    assert.equal(near.length, 0);
    const ticks = cues.filter(c => c.kind === 'tick');
    for (let i = 1; i < ticks.length; i++) {
      const gap = (ticks[i]?.t ?? 0) - (ticks[i - 1]?.t ?? 0);
      assert.ok(gap >= MIN_CUE_GAP_S, `gap ${gap}`);
    }
  });

  it('a long text block gets a quieter tick than a short one', () => {
    const second = info.scenes[1];
    assert.ok(second);
    const at = (t: number) =>
      cues.find(
        c => c.kind === 'tick' && Math.abs(c.t - (second.start + t)) < 1e-9,
      );
    assert.ok((at(1.2)?.gain ?? 1) < (at(0.6)?.gain ?? 0));
  });

  it('a number that counts has no tick, because it is not read', () => {
    const first = info.scenes[0];
    assert.ok(first);
    assert.ok(
      !cues.some(
        c => c.kind === 'tick' && Math.abs(c.t - (first.start + 2)) < 1e-9,
      ),
    );
  });

  it('a resolving chime starts the last scene', () => {
    const last = info.scenes[info.scenes.length - 1];
    assert.ok(last);
    const chime = cues.filter(c => c.kind === 'chime');
    assert.equal(chime.length, 1);
    assert.equal(chime[0]?.t, last.start);
    assert.equal(chime[0]?.source, 'ending');
  });

  it('a film with no text still gets its scene changes', () => {
    const bare = planCues({...info, texts: []}, plain, KEY);
    assert.equal(bare.filter(c => c.kind === 'whoosh').length, 9);
    assert.equal(bare.filter(c => c.kind === 'tick').length, 0);
  });

  it('every pitched cue has a note of the palette scale', () => {
    const root = pitchClass(KEY.key);
    for (const c of cues.filter(x => x.hz !== null)) {
      const midi = 69 + 12 * Math.log2((c.hz ?? 440) / 440);
      const step = (((Math.round(midi) - root) % 12) + 12) % 12;
      assert.ok(calm.scale.includes(step), `${c.kind} at ${c.t}: step ${step}`);
    }
  });
});

describe('explicit cues on a scene', () => {
  it('land at the scene start plus their own time', () => {
    const scenes = plain.map((s, i) =>
      i === 2
        ? {
            ...s,
            cues: [
              {at: 1.5, kind: 'hit' as const},
              {at: 3, kind: 'pop' as const, gain: 0.4},
            ],
          }
        : s,
    );
    const third = info.scenes[2];
    assert.ok(third);
    const spec = planCues(info, scenes, KEY).filter(c => c.source === 'spec');
    assert.deepEqual(
      spec.map(c => c.kind),
      ['hit', 'pop'],
    );
    assert.ok(Math.abs((spec[0]?.t ?? 0) - (third.start + 1.5)) < 1e-9);
    assert.ok(Math.abs((spec[1]?.t ?? 0) - (third.start + 3)) < 1e-9);
    assert.equal(spec[1]?.gain, 0.4);
  });

  it('land the same way on a plate scene', () => {
    const scenes = plain.map((s, i) =>
      i === 4
        ? {
            type: 'plate',
            duration: 9,
            plate: 'plates/a/tracks.json',
            cues: [{at: 2.25, kind: 'sting' as const}],
          }
        : s,
    );
    const fifth = info.scenes[4];
    assert.ok(fifth);
    const [sting] = planCues(info, scenes, KEY).filter(
      c => c.source === 'spec',
    );
    assert.equal(sting?.kind, 'sting');
    assert.ok(Math.abs((sting?.t ?? 0) - (fifth.start + 2.25)) < 1e-9);
  });

  it('are never dropped for being close to a derived cue', () => {
    const second = info.scenes[1];
    assert.ok(second);
    const scenes = plain.map((s, i) =>
      i === 1 ? {...s, cues: [{at: 0.62, kind: 'tick' as const}]} : s,
    );
    const ticks = planCues(info, scenes, KEY).filter(
      c => c.kind === 'tick' && Math.abs(c.t - (second.start + 0.62)) < 1e-9,
    );
    assert.equal(ticks.length, 1);
  });

  it('a rise keeps its length and defaults to two seconds', () => {
    const scenes = plain.map((s, i) =>
      i === 0
        ? {
            ...s,
            cues: [
              {at: 4, kind: 'rise' as const},
              {at: 7, kind: 'rise' as const, duration: 1},
            ],
          }
        : s,
    );
    const rises = planCues(info, scenes, KEY).filter(c => c.kind === 'rise');
    assert.deepEqual(
      rises.map(c => c.duration),
      [2, 1],
    );
  });
});

describe('checking a scene cues list', () => {
  const scene = (cues: unknown): SceneSpec =>
    ({type: 'title', duration: 5, cues}) as SceneSpec;

  it('an unknown kind names the kinds that exist', () => {
    assert.throws(
      () => sceneCues(scene([{at: 1, kind: 'bang'}]), 3),
      /scenes\[3\]\.cues\[0\]\.kind must be one of: tick, whoosh.*"bang"/,
    );
  });

  it('a time after the end of the scene is refused', () => {
    assert.throws(
      () => sceneCues(scene([{at: 6, kind: 'tick'}]), 0),
      /cues\[0\]\.at/,
    );
  });

  it('a duration on a cue that is not a rise is refused', () => {
    assert.throws(
      () => sceneCues(scene([{at: 1, kind: 'tick', duration: 2}]), 0),
      /only for "rise"/,
    );
  });

  it('a gain above 1 is refused', () => {
    assert.throws(
      () => sceneCues(scene([{at: 1, kind: 'tick', gain: 3}]), 0),
      /gain/,
    );
  });

  it('cues that are not a list are refused', () => {
    assert.throws(() => sceneCues(scene({at: 1}), 0), /must be a list/);
  });
});

describe('meta.sound.auto', () => {
  const own = plain.map((s, i) =>
    i === 3 ? {...s, cues: [{at: 1, kind: 'hit' as const}]} : s,
  );
  const base = planCues(info, own, KEY);

  it('a film with its own cue sheet and auto false plays only its cues', () => {
    const cues = planCues(info, own, KEY, resolveAuto(false));
    assert.deepEqual(
      cues.map(c => c.source),
      ['spec'],
    );
  });

  it('transition 0.35 scales only the whooshes', () => {
    const cues = planCues(info, own, KEY, resolveAuto({transition: 0.35}));
    assert.equal(cues.length, base.length);
    cues.forEach((c, i) => {
      const was = base[i];
      assert.ok(was);
      const scaled = c.source === 'transition';
      assert.ok(Math.abs(c.gain - was.gain * (scaled ? 0.35 : 1)) < 1e-12);
    });
  });

  it('ending false drops the chime and keeps the whooshes', () => {
    const cues = planCues(info, own, KEY, resolveAuto({ending: false}));
    assert.equal(cues.filter(c => c.kind === 'chime').length, 0);
    assert.equal(cues.filter(c => c.kind === 'whoosh').length, 9);
  });

  it('a tick gives way to a whoosh that auto keeps and not to one it drops', () => {
    const second = info.scenes[1];
    assert.ok(second);
    const near = (cues: typeof base) =>
      cues.filter(c => c.kind === 'tick' && Math.abs(c.t - second.start) < 1);
    const lone = {
      ...info,
      texts: [{...info.texts[0], scene: 1, settle: FIXTURE_OVERLAP / 2}],
    } as typeof info;
    assert.equal(near(planCues(lone, plain, KEY)).length, 0);
    const quiet = resolveAuto({transition: false});
    assert.equal(near(planCues(lone, plain, KEY, quiet)).length, 1);
  });

  it('absent auto gives the same cue list as before', () => {
    assert.deepEqual(planCues(info, own, KEY, resolveAuto(undefined)), base);
    assert.deepEqual(planCues(info, own, KEY, resolveAuto(true)), base);
  });

  it('a bad value is refused with a message that names the field', () => {
    const named = (value: unknown, field: string) =>
      assert.throws(
        () => resolveAuto(value),
        (e: Error) => e.message.startsWith(field) || e.message.includes(field),
      );
    named('quiet', 'meta.sound.auto');
    named({transition: 1.5}, 'meta.sound.auto.transition');
    named({text: 'low'}, 'meta.sound.auto.text');
    named({whoosh: 0.5}, 'meta.sound.auto has unknown key "whoosh"');
  });
});
