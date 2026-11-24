/**
 * @fileoverview What a stopped or failed command leaves behind: no browser,
 * no encoder, no temporary file, and no lost stills.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {after, describe, it} from 'node:test';
import {REEL_ENTRY} from '../../plugin/skills/video/scripts/core/paths.ts';
import {run} from '../../plugin/skills/video/scripts/core/process.ts';
import {missingTools, reel} from '../helpers/cli.ts';
import {builtInFilm, goodFilm} from '../helpers/films.ts';
import type {Project} from '../helpers/project.ts';
import {workspace} from '../helpers/project.ts';
import * as scenes from '../helpers/scenes.ts';

const ws = workspace();
after(() => ws.dispose());
const skip =
  missingTools() || (process.platform === 'win32' && 'not on Windows');

/** A scene that works for two seconds, then throws on every frame. */
const LATE_BOOM = `Reel.scene('late-boom', (ctx, s) => {
  const head = ctx.text('h2', 'rw-h2', s.heading);
  ctx.el.append(head);
  ctx.enter(head, 0.1);
  return t => {
    if (t > 2) {
      throw new Error('boom at a late time');
    }
  };
});
`;

/** The environment with the temp folder pointed at a folder of ours. */
function tmpEnv(tmp: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {...process.env};
  env.TMPDIR = tmp;
  return env;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(what: string, test: () => boolean): Promise<void> {
  for (let i = 0; i < 600; i++) {
    if (test()) {
      return;
    }
    await sleep(100);
  }
  assert.fail(`timed out waiting for ${what}`);
}

/** Lines of the process list that mention a marker, such as a folder. */
async function processesWith(marker: string): Promise<string[]> {
  const {stdout} = await run('ps', ['-eo', 'pid,args']);
  return stdout.split('\n').filter(line => line.includes(marker));
}

function segmentFiles(p: Project, suffix: string): string[] {
  const dir = join(p.dir, 'out', '.segments');
  return existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith(suffix))
    : [];
}

describe('lifecycle', {skip, timeout: 600_000}, () => {
  it('a render stopped with SIGTERM leaves no Chrome, no ffmpeg and no temporary segment files', async () => {
    const p = ws.project('sigterm', goodFilm(), {'ticker.ts': scenes.TICKER});
    const tmp = join(ws.root, 'tmp-sigterm');
    mkdirSync(tmp);
    const env = tmpEnv(tmp);
    const child = spawn(
      process.execPath,
      [REEL_ENTRY, 'render', p.spec, '--force'],
      {cwd: p.dir, env, stdio: 'ignore'},
    );
    const closed = new Promise<number | null>(resolve =>
      child.on('close', code => resolve(code)),
    );
    await waitFor('an encoder to be writing', () => {
      return segmentFiles(p, '.tmp.mp4').length > 0;
    });
    assert.ok((await processesWith(ws.root)).length > 2, 'nothing is running');
    child.kill('SIGTERM');
    assert.equal(await closed, 143);
    assert.deepEqual(await processesWith(ws.root), []);
    assert.deepEqual(segmentFiles(p, '.tmp.mp4'), []);
    assert.deepEqual(readdirSync(tmp), [], 'the temp folder is not empty');
  });

  it('a render that fails in one scene stops the other encoders', async () => {
    const film = {
      ...builtInFilm('Boom'),
      scenes: [
        {type: 'title', duration: 14, title: 'A long first scene'},
        {type: 'late-boom', duration: 6, heading: 'Breaks late'},
      ],
    };
    const p = ws.project('boom', film, {'late-boom.ts': LATE_BOOM});
    const tmp = join(ws.root, 'tmp-boom');
    mkdirSync(tmp);
    const started = Date.now();
    const result = await runWithTmp(p, tmp, ['render', p.spec, '--force']);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /boom at a late time/);
    assert.ok(Date.now() - started < 120_000);
    assert.deepEqual(await processesWith(ws.root), []);
    assert.deepEqual(segmentFiles(p, '.tmp.mp4'), []);
    assert.deepEqual(segmentFiles(p, '.mp4'), [], 'a half segment was kept');
    assert.deepEqual(readdirSync(tmp), []);
  });

  it('stills with a custom TMPDIR leave nothing in it', async () => {
    const p = ws.project('tmpdir', builtInFilm('Temp'));
    const tmp = join(ws.root, 'tmp-stills');
    mkdirSync(tmp);
    const result = await runWithTmp(p, tmp, ['stills', p.spec]);
    assert.equal(result.code, 0, result.output);
    assert.deepEqual(readdirSync(tmp), []);
  });

  it('a bad --at keeps the stills that were already there', async () => {
    const p = ws.project('keep', builtInFilm('Keep'));
    const first = await reel(p.dir, ['stills', p.spec]);
    assert.equal(first.code, 0, first.output);
    const dir = join(p.dir, 'out', 'stills');
    const before = readdirSync(dir).sort();
    assert.ok(before.length > 0);
    const bad = await reel(p.dir, ['stills', p.spec, '--at', '500']);
    assert.equal(bad.code, 1);
    assert.match(bad.output, /outside the film/);
    assert.deepEqual(readdirSync(dir).sort(), before);
  });

  it('numeric options out of range fail with the option, the value and the range', async () => {
    const p = ws.project('ranges', builtInFilm('Ranges'));
    const cases: [string[], RegExp][] = [
      [['stills', p.spec, '--size', '0x0'], /--size width .* got 0/],
      [['stills', p.spec, '--size', '2x2'], /from 16 to 8192, got 2/],
      [['render', p.spec, '--fps', '0'], /--fps must be a number .* got 0/],
      [
        ['stills', p.spec, '--every', '1', '--from', '5', '--to', '3'],
        /--from/,
      ],
      [
        ['preview', p.spec, '--port', '99999'],
        /--port .* 0 to 65535, got 99999/,
      ],
      [['preview', p.spec, '--port', '1.5'], /--port .* integer .* got 1\.5/],
    ];
    for (const [args, pattern] of cases) {
      const r = await reel(p.dir, args);
      assert.equal(r.code, 1, args.join(' '));
      assert.match(r.output, pattern, args.join(' '));
      assert.ok(!/\n\s+at /.test(r.output), `a stack trace: ${r.output}`);
    }
  });
});

/** Runs a command with its temp folder set, so leftovers can be found. */
function runWithTmp(p: Project, tmp: string, args: string[]) {
  return new Promise<{code: number | null; output: string}>(resolve => {
    const child = spawn(process.execPath, [REEL_ENTRY, ...args], {
      cwd: p.dir,
      env: tmpEnv(tmp),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (d: Buffer) => {
        output += d.toString();
      });
    }
    child.on('close', code => resolve({code, output}));
  });
}
