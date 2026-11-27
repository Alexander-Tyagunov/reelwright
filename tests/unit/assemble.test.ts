/**
 * @fileoverview `assemble` on the first film's plan, reduced to three shots,
 * with its intro and outro: the spec it writes is the one the first film was
 * made from.
 */
import assert from 'node:assert/strict';
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
