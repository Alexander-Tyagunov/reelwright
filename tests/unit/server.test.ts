/**
 * @fileoverview The film server: it stays inside the project folder and the
 * runtime, and serves TypeScript as JavaScript. It binds a local port but
 * needs no browser.
 */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {after, before, describe, it} from 'node:test';
import type {FilmServer} from '../../plugin/skills/video/scripts/server/server.ts';
import {serve} from '../../plugin/skills/video/scripts/server/server.ts';
import {put, removeDir, tempDir} from '../helpers/tmp.ts';

let root = '';
let server: FilmServer;

before(async () => {
  root = tempDir();
  const project = join(root, 'project');
  put(root, 'secret.txt', 'TOP-SECRET-OUTSIDE');
  put(project, 'film.json', '{"scenes": []}');
  put(project, 'inside.txt', 'inside the project');
  put(
    project,
    'scenes/typed.ts',
    'export type Label = string;\nconst count: number = 3;\nexport const label: Label = String(count);\n',
  );
  put(
    project,
    'scenes/enum.ts',
    'enum Color {Red}\nexport const c = Color.Red;\n',
  );
  server = await serve({
    specPath: join(project, 'film.json'),
    projectDir: project,
  });
});
after(async () => {
  await server.close();
  removeDir(root);
});

async function get(path: string) {
  const res = await fetch(new URL(path, server.url));
  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    body: await res.text(),
  };
}

describe('film server', () => {
  it('listens on 127.0.0.1 only', () => {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  });

  it('serves the film page at the root and the spec at /__film.json', async () => {
    assert.match((await get('/')).type, /text\/html/);
    assert.deepEqual(JSON.parse((await get('/__film.json')).body), {
      scenes: [],
    });
  });

  it('a project file is served as it is', async () => {
    assert.equal((await get('/inside.txt')).body, 'inside the project');
  });

  it('a request that climbs out of the project folder never gets the file outside', async () => {
    const tries = [
      '/../secret.txt',
      '/..%2fsecret.txt',
      '/%2e%2e/secret.txt',
      '/scenes/..%2f..%2fsecret.txt',
      '/..%5csecret.txt',
      '/inside.txt%00/../../secret.txt',
    ];
    for (const path of tries) {
      const r = await get(path);
      assert.equal(r.status, 404, path);
      assert.ok(!r.body.includes('TOP-SECRET'), path);
    }
  });

  it('a request that climbs out of the runtime folder is refused', async () => {
    for (const path of [
      '/__reel/runtime/..%2f..%2freel.ts',
      '/__reel/shared/..%2freel.ts',
      '/__reel/unknown/x',
    ]) {
      assert.equal((await get(path)).status, 404, path);
    }
  });

  it('a .ts file is served as JavaScript with its types removed', async () => {
    const r = await get('/scenes/typed.ts');
    assert.match(r.type, /text\/javascript/);
    assert.ok(!r.body.includes('type Label'));
    assert.ok(!r.body.includes(': number'));
    assert.match(r.body, /const count\s+= 3/);
  });

  it('an engine .ts file is served as JavaScript too', async () => {
    const r = await get('/__reel/runtime/timeline.ts');
    assert.equal(r.status, 200);
    assert.ok(!r.body.includes('export interface'));
    assert.match(r.body, /export function computeTimeline/);
  });

  it('a project scene that uses an enum is refused and names its file', async () => {
    const r = await get('/scenes/enum.ts');
    assert.equal(r.status, 500);
    assert.match(r.body, /enum\.ts/);
  });

  it('a request that is not GET is refused', async () => {
    const res = await fetch(new URL('/inside.txt', server.url), {
      method: 'POST',
    });
    assert.equal(res.status, 405);
  });
});
