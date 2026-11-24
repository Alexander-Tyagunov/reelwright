/**
 * @fileoverview Delivery paths: export with a soundtrack, the single-file
 * build, starting a project and a typed project scene.
 */
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {after, describe, it} from 'node:test';
import {pathToFileURL} from 'node:url';
import {
  pageErrors,
  waitUntilReady,
} from '../../plugin/skills/video/scripts/browser/film.ts';
import {launch} from '../../plugin/skills/video/scripts/browser/launch.ts';
import {run} from '../../plugin/skills/video/scripts/core/process.ts';
import {measureLoudness} from '../../plugin/skills/video/scripts/video/loudness.ts';
import {missingTools, reel} from '../helpers/cli.ts';
import {builtInFilm, goodFilm, withScene} from '../helpers/films.ts';
import {gateOf, qa, render, workspace} from '../helpers/project.ts';
import * as scenes from '../helpers/scenes.ts';

const ws = workspace();
after(() => ws.dispose());
const skip = missingTools();

describe('delivery', {skip, timeout: 900_000}, () => {
  it('export --preset x --audio lands at -14 LUFS within 1 and a true peak at or below -1 dBTP', async () => {
    const p = ws.project('export', builtInFilm('Export'));
    await render(p);
    const tone = join(p.dir, 'tone.wav');
    await run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=330:duration=10',
      '-af',
      'volume=0.8',
      tone,
    ]);
    const made = await reel(p.dir, [
      'export',
      p.spec,
      '--preset',
      'x',
      '--audio',
      tone,
    ]);
    assert.equal(made.code, 0, made.output);
    const out = join(p.dir, 'out', 'export', 'film-x.mp4');
    assert.ok(existsSync(out), `missing ${out}`);
    const loud = await measureLoudness(out);
    assert.ok(Math.abs(loud.lufs + 14) <= 1, `loudness ${loud.lufs} LUFS`);
    assert.ok(loud.truePeak <= -1, `true peak ${loud.truePeak} dBTP`);
  });

  it('build writes one HTML file that loads from file:// with its project scene', async () => {
    const p = ws.project('build', goodFilm(), {'ticker.ts': scenes.TICKER});
    const made = await reel(p.dir, ['build', p.spec]);
    assert.equal(made.code, 0, made.output);
    const html = join(p.dir, 'out', 'film.html');
    assert.ok(
      !readFileSync(html, 'utf8').includes(p.dir),
      'the file must not point into the project folder',
    );
    const browser = await launch();
    try {
      const page = await browser.newPage({width: 1280, height: 720});
      await page.send('Page.navigate', {
        url: `${pathToFileURL(html).href}?render=1`,
      });
      assert.equal(await waitUntilReady(page), true);
      assert.deepEqual(await pageErrors(page), []);
      const info = (await page.eval('window.__film')) as {
        scenes: {type: string}[];
      };
      assert.deepEqual(
        info.scenes.map(s => s.type),
        ['title', 'bullets', 'ticker'],
      );
    } finally {
      await browser.close();
    }
  });

  it('a .ts project scene with types renders and passes the page gates', async () => {
    const film = withScene('Typed', {
      type: 'typed-rows',
      duration: 4.5,
      heading: 'Typed rows',
      rows: [
        {label: 'Alpha', value: 3},
        {label: 'Beta', value: 5},
      ],
    });
    const p = ws.project('typed', film, {'typed-rows.ts': scenes.TYPED});
    await render(p);
    const {report} = await qa(p);
    assert.equal(
      gateOf(report, 'load').status,
      'PASS',
      gateOf(report, 'load').details.join('; '),
    );
    assert.notEqual(report.verdict, 'fail');
  });
});

describe('init', () => {
  it('refuses a folder that already has files and leaves them alone', async () => {
    const dir = join(ws.root, 'taken');
    mkdirSync(dir, {recursive: true});
    writeFileSync(join(dir, 'notes.txt'), 'keep me');
    const r = await reel(ws.root, ['init', dir, '--template', 'blank']);
    assert.equal(r.code, 1);
    assert.match(
      r.output,
      /already exists and is not empty\. Pick a new folder name/,
    );
    assert.equal(readFileSync(join(dir, 'notes.txt'), 'utf8'), 'keep me');
    assert.ok(!existsSync(join(dir, 'film.json')));
  });

  it('refuses an unknown template and lists the available ones', async () => {
    const r = await reel(ws.root, [
      'init',
      join(ws.root, 'fresh'),
      '--template',
      'wedding',
    ]);
    assert.equal(r.code, 1);
    assert.match(
      r.output,
      /unknown template "wedding"\. Available templates: .*release/,
    );
  });

  it('refuses an odd --size before writing anything', async () => {
    const dir = join(ws.root, 'odd');
    const r = await reel(ws.root, ['init', dir, '--size', '1081x1920']);
    assert.equal(r.code, 1);
    assert.match(r.output, /must be even/);
    assert.ok(!existsSync(join(dir, 'film.json')));
  });

  it('creates a project that has a film.json with the requested size', async () => {
    const dir = join(ws.root, 'created');
    const r = await reel(ws.root, [
      'init',
      dir,
      '--template',
      'metrics',
      '--size',
      '1080x1350',
    ]);
    assert.equal(r.code, 0, r.output);
    const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
    assert.equal(film.meta.width, 1080);
    assert.equal(film.meta.height, 1350);
  });
});
