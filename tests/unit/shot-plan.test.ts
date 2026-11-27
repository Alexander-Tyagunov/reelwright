/**
 * @fileoverview The shot plan of the first film, reduced: what `reel plan`
 * accepts, what it fails, and that fields of the 3D side pass through.
 */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {describe, it} from 'node:test';
import {UserError} from '../../plugin/skills/video/scripts/core/errors.ts';
import {checkPlan} from '../../plugin/skills/video/scripts/plan/checks.ts';
import {loadPlan} from '../../plugin/skills/video/scripts/plan/load.ts';
import {
  allShots,
  parsePlan,
} from '../../plugin/skills/video/scripts/plan/parse.ts';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'first-film');
const {plan} = loadPlan(join(ROOT, 'plan', 'shots.json'));

/** A copy of the reduced plan that a test may change. */
function copy(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(plan)) as Record<string, unknown>;
}

function statuses(doc: unknown) {
  const checks = checkPlan(parsePlan(doc, 'plan'), ROOT);
  return Object.fromEntries(checks.map(c => [c.name, c.status]));
}

describe('the first film plan, reduced to three shots', () => {
  it('passes every check with no failure', () => {
    const checks = checkPlan(plan, ROOT);
    assert.deepEqual(
      checks.filter(c => c.status === 'FAIL'),
      [],
    );
  });

  it('keeps the camera and walkers of the 3D side on every shot', () => {
    const first = allShots(plan)[0] as unknown as Record<string, unknown>;
    assert.ok(first.camera && first.walkers && first.walker_tracks);
  });

  it('a plan with no formats has the one 16:9 format of 1920x1080', () => {
    assert.deepEqual(plan.formats, {'16:9': [1920, 1080]});
  });
});

describe('what the plan check fails', () => {
  it('a label shown for 1 s that needs 3 s to read fails the reading check', () => {
    const doc = copy() as {
      sequences: {shots: {labels: {to_pose: number; from_pose: number}[]}[]}[];
    };
    const label = doc.sequences[0]?.shots[0]?.labels[0];
    assert.ok(label);
    label.from_pose = 40;
    label.to_pose = 51;
    const failed = Object.entries(statuses(doc)).filter(
      ([, s]) => s === 'FAIL',
    );
    assert.match(String(failed[0]?.[0]), /on screen at least/);
  });

  it('a label on a track the shot does not list fails', () => {
    const doc = copy() as {sequences: {shots: {tracks: string[]}[]}[]};
    const shot = doc.sequences[0]?.shots[0];
    assert.ok(shot);
    shot.tracks = ['traveller'];
    assert.equal(
      statuses(doc)["every label track is listed in its shot's tracks"],
      'FAIL',
    );
  });

  it('a cue of kind "bonk" is refused with the path of the cue and the kinds that exist', () => {
    const doc = copy() as {sequences: {shots: {cues: {kind: string}[]}[]}[]};
    const cue = doc.sequences[0]?.shots[0]?.cues[0];
    assert.ok(cue);
    cue.kind = 'bonk';
    assert.throws(
      () => parsePlan(doc, 'plan'),
      (e: Error) =>
        e instanceof UserError &&
        /sequences\[0\]\.shots\[0\]\.cues\[0\]\.kind/.test(e.message) &&
        /tick/.test(e.message),
    );
  });

  it('a total_poses that is not the sum of the shots fails the totals check', () => {
    const doc = copy();
    doc.total_poses = 1054;
    assert.equal(statuses(doc)['totals agree with the shots'], 'FAIL');
  });

  it('a plan whose plates are not rendered only warns', () => {
    const checks = checkPlan(plan, join(ROOT, 'nowhere'));
    const plates = checks.find(c => c.name === 'every plate exists');
    assert.equal(plates?.status, 'WARN');
  });
});
