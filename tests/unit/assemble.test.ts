/**
 * @fileoverview `assemble` on the first film's plan, reduced to three shots,
 * with its intro and outro: the spec it writes is the one the first film was
 * made from.
 */
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, it} from 'node:test';
import {UserError} from '../../plugin/skills/video/scripts/core/errors.ts';
import {assemble} from '../../plugin/skills/video/scripts/plan/assemble.ts';
import {
  loadPlan,
  loadSideFiles,
} from '../../plugin/skills/video/scripts/plan/load.ts';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'first-film');
const {plan, dir} = loadPlan(join(ROOT, 'plan', 'shots.json'));
const side = loadSideFiles(dir);
const BASE = {shots: null, noSound: false, root: ROOT};

type Scene = {
  id: string;
  duration: number;
  plate: string;
  chapter?: string;
  labels: Record<string, unknown>[];
  texts?: Record<string, unknown>[];
  cues: {at: number; kind: string; gain: number}[];
};

function scenes(options: object = {}): Scene[] {
  const {spec} = assemble(plan, side, {...BASE, ...options});
  return spec.scenes as unknown as Scene[];
}

describe('assemble with the intro and outro of the first film', () => {
  const all = scenes({intro: 'plates/A0', outro: 'plates/Z0'});

  it('puts the intro first and the outro last, shots in plan order', () => {
    assert.deepEqual(
      all.map(s => s.id),
      ['A0', 'A1', 'A2', 'C3', 'Z0'],
    );
  });

  it('A1 label "Claude" shows from 2.5 s to 5.8333 s and its line is a text at the foot', () => {
    const label = all[1]?.labels[0];
    assert.equal(label?.from, 2.5);
    assert.equal(label?.to, 5.8333);
    assert.equal(label?.side, 'top');
    assert.equal(
      all[1]?.texts?.[0]?.text,
      'First Claude, available to partners',
    );
  });

  it('the override of A2 "Claude Instant 1.2" moves it to the top at offset 9', () => {
    const label = all[2]?.labels.find(l => l.text === 'Claude Instant 1.2');
    assert.equal(label?.side, 'top');
    assert.equal(label?.offset, 9);
  });

  it('plan cues and extra cues of C3 are merged and sorted by pose', () => {
    const at = all[3]?.cues.map(c => c.at) ?? [];
    assert.deepEqual(
      at,
      [...at].sort((a, b) => a - b),
    );
    assert.ok(at.includes(0.25), 'the extra tick on pose 4');
  });

  it('the outro takes its texts from outro-texts.json and its length from its plate', () => {
    assert.equal(all[4]?.duration, 3.25);
    assert.equal(all[4]?.texts?.length, 3);
  });

  it('the sound curve starts quiet under the intro and ends at 0.02', () => {
    const {spec} = assemble(plan, side, {
      ...BASE,
      intro: 'plates/A0',
      outro: 'plates/Z0',
    });
    const sound = spec.meta?.sound as {
      intensity: {at: number; value: number}[];
      palette: string;
    };
    assert.deepEqual(sound.intensity[0], {at: 0, value: 0.02});
    assert.equal(sound.intensity.at(-1)?.value, 0.02);
    assert.equal(sound.palette, 'storybook');
  });
});

describe('assemble options', () => {
  it('--no-sound leaves meta.sound out', () => {
    const {spec} = assemble(plan, side, {...BASE, noSound: true});
    assert.equal(spec.meta?.sound, undefined);
  });

  it('--shots C3 writes one scene', () => {
    assert.deepEqual(
      scenes({shots: ['C3']}).map(s => s.id),
      ['C3'],
    );
  });

  it('an unknown shot says which shots the plan has', () => {
    assert.throws(
      () => scenes({shots: ['Q9']}),
      (e: Error) => e instanceof UserError && /A1, A2, C3/.test(e.message),
    );
  });

  it('a chapter title of a shot is copied to its scene', () => {
    const doc = structuredClone(plan);
    const shot = doc.sequences[0]?.shots[0];
    assert.ok(shot);
    shot.chapter = 'One light';
    const {spec} = assemble(doc, side, BASE);
    assert.equal((spec.scenes[0] as {chapter?: string}).chapter, 'One light');
  });

  it('a second format reads plates from the folder with @9x16 and takes its size', () => {
    const doc = structuredClone(plan);
    doc.formats = {'16:9': [1920, 1080], '9:16': [1080, 1920]};
    const {spec} = assemble(doc, side, {...BASE, format: '9:16'});
    assert.equal(
      (spec.scenes[0] as unknown as Scene).plate,
      'plates/A1@9x16/tracks.json',
    );
    assert.equal(spec.meta?.width, 1080);
    assert.equal(spec.meta?.height, 1920);
  });

  it('a format the plan lacks is refused with the formats it has', () => {
    assert.throws(
      () => scenes({format: '1:1'}),
      (e: Error) => e instanceof UserError && /16:9/.test(e.message),
    );
  });
});

describe('assemble with shots left out', () => {
  it('--shots A1,C3 gives C3 its own part of the curve, not the curve of A2', () => {
    const doc = structuredClone(plan);
    const [a1, a2, c3] = doc.sequences.flatMap(s => s.shots);
    assert.ok(a1 && a2 && c3);
    const rate = doc.fps_poses;
    const t1 = a1.poses / rate;
    const t2 = t1 + a2.poses / rate;
    const t3 = t2 + c3.poses / rate;
    doc.sound.intensity = [
      {at_s: 0, value: 0.1},
      {at_s: t1, value: 0.1},
      {at_s: t2, value: 0.5},
      {at_s: t3, value: 0.9},
    ];
    const {spec} = assemble(doc, side, {...BASE, shots: ['A1', 'C3']});
    const film = spec.scenes.reduce((t, s) => t + s.duration, 0);
    const sound = spec.meta?.sound as {
      intensity: {at: number; value: number}[];
    };
    const curve = sound.intensity;
    assert.ok(Math.abs((curve.at(-1)?.at ?? 0) - film) < 0.001);
    const start = a1.poses / rate;
    const atC3 = curve.filter(p => Math.abs(p.at - start) < 0.001).at(-1);
    assert.equal(atC3?.value, 0.5, 'C3 starts at the value A2 ended with');
    assert.equal(curve.at(-1)?.value, 0.9);
    assert.ok(!curve.some(p => p.value === 0.5 && p.at > start + 0.001));
  });
});

describe('assemble refuses what would write a wrong spec', () => {
  it('an intro folder that is also a shot id is an error', () => {
    assert.throws(
      () => scenes({intro: 'plates/A1'}),
      (e: Error) => e instanceof UserError && /"A1"/.test(e.message),
    );
  });

  it('an intro whose tracks.json is not JSON names the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rw-intro-'));
    mkdirSync(join(dir, 'plates', 'BR'), {recursive: true});
    writeFileSync(join(dir, 'plates', 'BR', 'tracks.json'), '{nope');
    assert.throws(
      () => scenes({intro: 'plates/BR', root: dir}),
      (e: Error) => e instanceof UserError && /BR.tracks\.json/.test(e.message),
    );
  });

  it('an intro whose tracks.json has no frames names the file and the field', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rw-intro-'));
    mkdirSync(join(dir, 'plates', 'BR'), {recursive: true});
    writeFileSync(
      join(dir, 'plates', 'BR', 'tracks.json'),
      JSON.stringify({version: 1, fps: 12, frame_pattern: 'f/%04d.jpg'}),
    );
    assert.throws(
      () => scenes({intro: 'plates/BR', root: dir}),
      (e: Error) =>
        e instanceof UserError &&
        /BR.tracks\.json/.test(e.message) &&
        /frames/.test(e.message),
    );
  });

  it('plate paths are written relative to the folder of the spec', () => {
    const all = scenes({specDir: join(ROOT, 'out')});
    assert.equal(all[0]?.plate, '../plates/A1/tracks.json');
  });
});
