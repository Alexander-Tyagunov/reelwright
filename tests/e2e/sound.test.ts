/**
 * @fileoverview Generated sound through the real pipeline: a rendered film
 * carries an AAC track as long as the picture, `--no-sound` leaves it
 * silent, a change of palette re-mixes without redrawing a scene, the audio
 * gate catches a missing track, a plate scene takes cues, and two specs in
 * one folder keep their own files.
 */
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {join} from 'node:path';
import {after, before, describe, it} from 'node:test';
import {run} from '../../plugin/skills/video/scripts/core/process.ts';
import {measureLoudness} from '../../plugin/skills/video/scripts/video/loudness.ts';
import {probeStreams} from '../../plugin/skills/video/scripts/video/probe.ts';
import {missingTools, reel} from '../helpers/cli.ts';
import {builtInFilm} from '../helpers/films.ts';
import {writePlate} from '../helpers/plate.ts';
import type {Project} from '../helpers/project.ts';
import {gateOf, qa, render, SMALL, workspace} from '../helpers/project.ts';

const ws = workspace();
const skip = missingTools();
after(() => ws.dispose());
before(() => {
  if (!skip) {
    writePlate(join(ws.root, '_src'));
  }
});

/** Scene numbers that a render printed with the given verb. */
function scenesWith(output: string, verb: 'rendered' | 'reused'): number[] {
  const pattern = new RegExp(
    `scene\\s+(\\d+)\\s+\\S+\\s+\\d+ frames ${verb}`,
    'g',
  );
  // Two workers draw scenes at once, so the lines arrive in any order.
  return [...output.matchAll(pattern)]
    .map(m => Number(m[1]))
    .sort((a, b) => a - b);
}

function video(p: Project): string {
  return join(p.dir, 'out', 'film.mp4');
}

async function streamsOf(file: string) {
  const r = await probeStreams(file);
  return {
    video: r.streams.find(s => s.type === 'video'),
    audio: r.streams.find(s => s.type === 'audio'),
  };
}

async function md5(file: string, map: '0:a' | '0:v'): Promise<string> {
  const copy = map === '0:v' ? ['-c', 'copy'] : [];
  const r = await run('ffmpeg', [
    ...['-v', 'error', '-i', file, '-map', map, ...copy, '-f', 'md5', '-'],
  ]);
  return r.stdout.trim();
}

function withSound(p: Project, sound: unknown): void {
  const film = JSON.parse(readFileSync(p.spec, 'utf8'));
  film.meta.sound = sound;
  writeFileSync(p.spec, JSON.stringify(film, null, 2));
}

describe('generated sound', {skip, timeout: 900_000}, () => {
  const p = ws.project('sound', builtInFilm('Sound', {sound: true}));

  it('a film with meta.sound true renders one h264 and one AAC stream of equal length and passes the audio gate', async () => {
    const made = await render(p);
    assert.match(made.output, /sound: palette calm, \d+ cues, -1[34]\.\d LUFS/);
    const {video: v, audio: a} = await streamsOf(video(p));
    assert.equal(v?.codec, 'h264');
    assert.equal(a?.codec, 'aac');
    assert.ok(Math.abs((a?.duration ?? 0) - (v?.duration ?? 99)) <= 0.1);
    const loud = await measureLoudness(video(p));
    assert.ok(Math.abs(loud.lufs + 14) <= 0.5, `loudness ${loud.lufs} LUFS`);
    assert.ok(loud.truePeak <= -1, `true peak ${loud.truePeak} dBTP`);
    const {report} = await qa(p);
    const gate = gateOf(report, 'audio');
    assert.equal(gate.status, 'PASS', gate.details.join('; '));
    assert.ok(statSync(join(p.dir, 'out', 'sound.wav')).size > 1000);
  });

  it('render with --no-sound leaves the file silent, and qa then fails and says to render again', async () => {
    const made = await render(p, ['--no-sound']);
    assert.match(made.output, /sound: none/);
    assert.equal((await streamsOf(video(p))).audio, undefined);
    const {code, report} = await qa(p);
    const gate = gateOf(report, 'audio');
    assert.equal(gate.status, 'FAIL');
    assert.match(gate.summary, /no audio track: run render again/);
    assert.equal(code, 1);
  });

  it('changing only the palette reuses every scene and changes the audio and not the picture', async () => {
    await render(p);
    const before = {
      audio: await md5(video(p), '0:a'),
      picture: await md5(video(p), '0:v'),
    };
    withSound(p, {palette: 'tense'});
    const again = (await render(p)).output;
    assert.deepEqual(scenesWith(again, 'rendered'), []);
    assert.deepEqual(scenesWith(again, 'reused'), [1, 2]);
    assert.notEqual(await md5(video(p), '0:a'), before.audio);
    assert.equal(await md5(video(p), '0:v'), before.picture);
  });

  it('adding an explicit cue to a scene re-mixes without redrawing it', async () => {
    withSound(p, {palette: 'tense'});
    const film = JSON.parse(readFileSync(p.spec, 'utf8'));
    film.scenes[1].cues = [{at: 1.5, kind: 'hit'}];
    writeFileSync(p.spec, JSON.stringify(film, null, 2));
    const again = (await render(p)).output;
    assert.deepEqual(scenesWith(again, 'rendered'), []);
    const cues = JSON.parse(
      readFileSync(join(p.dir, 'out', 'sound.json'), 'utf8'),
    );
    assert.ok(cues.cues.some((c: {kind: string}) => c.kind === 'hit'));
  });

  it('reel sound writes sound.wav and sound.json and prints length, cues, loudness and peak', async () => {
    const made = await reel(p.dir, ['sound', p.spec]);
    assert.equal(made.code, 0, made.output);
    assert.match(made.output, /palette tense, \d+(\.\d+)?s, \d+ cues/);
    assert.match(
      made.output,
      /-1[34]\.\d LUFS integrated, true peak -\d\.\d dBTP/,
    );
    const wav = statSync(join(p.dir, 'out', 'sound.wav')).size;
    const {video: v} = await streamsOf(video(p));
    assert.ok(Math.abs((wav - 44) / 4 / 48000 - (v?.duration ?? 0)) < 0.1);
  });

  it('export keeps the film sound, a given --audio file wins, and a GIF has none', async () => {
    await render(p);
    const kept = await reel(p.dir, ['export', p.spec, '--preset', 'web']);
    assert.equal(kept.code, 0, kept.output);
    const web = join(p.dir, 'out', 'export', 'film-web.mp4');
    assert.equal((await streamsOf(web)).audio?.codec, 'aac');
    assert.equal(await md5(web, '0:a'), await md5(video(p), '0:a'));
    const tone = join(p.dir, 'tone.wav');
    await run('ffmpeg', [
      ...['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=9'],
      tone,
    ]);
    const own = await reel(p.dir, [
      'export',
      p.spec,
      '--preset',
      'x',
      '--audio',
      tone,
    ]);
    assert.equal(own.code, 0, own.output);
    const x = join(p.dir, 'out', 'export', 'film-x.mp4');
    assert.notEqual(await md5(x, '0:a'), await md5(video(p), '0:a'));
    const gif = await reel(p.dir, ['export', p.spec, '--preset', 'gif']);
    assert.equal(gif.code, 0, gif.output);
    const file = join(p.dir, 'out', 'export', 'film-gif.gif');
    assert.equal((await streamsOf(file)).audio, undefined);
  });
});

describe('sound cues on a plate scene', {skip, timeout: 900_000}, () => {
  it('an explicit cue on a plate scene lands at the scene start plus its time', async () => {
    const film = {
      meta: {title: 'Plate sound', ...SMALL, lead: 0, sound: {palette: 'epic'}},
      scenes: [
        {type: 'title', duration: 3, title: 'Before the plate'},
        {
          type: 'plate',
          duration: 3,
          plate: 'plates/shot01/tracks.json',
          cues: [{at: 1.25, kind: 'boom', gain: 0.8}],
        },
      ],
    };
    const p = ws.project('plate-sound', film as never);
    cpSync(join(ws.root, '_src', 'plates'), join(p.dir, 'plates'), {
      recursive: true,
    });
    const made = await reel(p.dir, ['sound', p.spec]);
    assert.equal(made.code, 0, made.output);
    const list = JSON.parse(
      readFileSync(join(p.dir, 'out', 'sound.json'), 'utf8'),
    );
    const boom = list.cues.find((c: {kind: string}) => c.kind === 'boom');
    assert.ok(boom, 'no boom cue in sound.json');
    const start = 3 - 0.45;
    assert.ok(Math.abs(boom.t - (start + 1.25)) < 0.01, `boom at ${boom.t}`);
    assert.equal(boom.source, 'spec');
  });
});

describe('two specs in one folder', {skip, timeout: 900_000}, () => {
  it('film.json and film-desk.json render, check and export without touching each other', async () => {
    const a = ws.project('pair', builtInFilm('Alpha', {sound: true}));
    const deskSpec = join(a.dir, 'film-desk.json');
    writeFileSync(
      deskSpec,
      JSON.stringify(
        builtInFilm('Desk', {sound: {palette: 'bright'}}),
        null,
        2,
      ),
    );
    await render(a);
    const alpha = {
      size: statSync(join(a.dir, 'out', 'film.mp4')).size,
      audio: await md5(join(a.dir, 'out', 'film.mp4'), '0:a'),
    };
    const desk = await reel(a.dir, ['render', deskSpec]);
    assert.equal(desk.code, 0, desk.output);
    assert.deepEqual(scenesWith(desk.output, 'reused'), [], 'shared a cache');
    const out = (name: string) => join(a.dir, 'out', name);
    for (const name of [
      'film.mp4',
      'film-desk.mp4',
      'render.json',
      'film-desk.render.json',
      'sound.wav',
      'film-desk.sound.wav',
    ]) {
      assert.ok(existsSync(out(name)), `missing out/${name}`);
    }
    assert.equal(statSync(out('film.mp4')).size, alpha.size);
    assert.equal(await md5(out('film.mp4'), '0:a'), alpha.audio);
    assert.notEqual(await md5(out('film-desk.mp4'), '0:a'), alpha.audio);
    const check = await reel(a.dir, ['qa', deskSpec]);
    assert.equal(check.code, 0, check.output);
    assert.ok(existsSync(out('film-desk.qa-report.json')));
    assert.ok(
      !existsSync(out('qa-report.json')),
      'desk qa wrote the film report',
    );
    const exp = await reel(a.dir, ['export', deskSpec, '--preset', 'web']);
    assert.equal(exp.code, 0, exp.output);
    assert.ok(existsSync(out('film-desk.export/film-desk-web.mp4')));
    assert.ok(!existsSync(out('export')), 'desk export wrote into out/export');
  });
});
