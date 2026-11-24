/**
 * @fileoverview The film server: it stays inside the project folder and the
 * runtime, and serves TypeScript as JavaScript. It binds a local port but
 * needs no browser.
 */
import assert from 'node:assert/strict';
import {symlinkSync} from 'node:fs';
import {request} from 'node:http';
import {connect} from 'node:net';
import {networkInterfaces} from 'node:os';
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
  put(project, '.env', 'API_KEY=SECRET-DOTFILE');
  put(project, '.git/config', 'SECRET-DOTDIR');
  symlinkSync(join(root, 'secret.txt'), join(project, 'link.txt'));
  symlinkSync(join(project, 'inside.txt'), join(project, 'alias.txt'));
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

function connectTo(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({host, port}, () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', reject);
  });
}

function statusWithHost(port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      {host: '127.0.0.1', port, path: '/inside.txt', headers: {host}},
      res => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function get(path: string) {
  const res = await fetch(new URL(path, server.url));
  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    body: await res.text(),
  };
}

describe('film server', () => {
  it('listens on 127.0.0.1 only', async () => {
    assert.equal(server.boundAddress, '127.0.0.1');
    const port = Number(new URL(server.url).port);
    const outside = Object.values(networkInterfaces())
      .flat()
      .find(i => i?.family === 'IPv4' && !i.internal);
    if (outside) {
      await assert.rejects(connectTo(outside.address, port), /ECONNREFUSED/);
    }
  });

  it('a dotfile or a file in a dot folder is not served', async () => {
    for (const path of ['/.env', '/%2eenv', '/.git/config', '/a/../.env']) {
      const r = await get(path);
      assert.equal(r.status, 404, path);
      assert.ok(!r.body.includes('SECRET'), path);
    }
  });

  it('a link that points outside the project is refused, one inside is served', async () => {
    const out = await get('/link.txt');
    assert.equal(out.status, 404);
    assert.ok(!out.body.includes('TOP-SECRET'));
    assert.equal((await get('/alias.txt')).body, 'inside the project');
  });

  it('a request with a foreign Host header is refused with 403', async () => {
    const port = Number(new URL(server.url).port);
    for (const host of ['evil.example', `evil.example:${port}`, 'localhost']) {
      assert.equal(await statusWithHost(port, host), 403, host);
    }
    assert.equal(await statusWithHost(port, `localhost:${port}`), 200);
    assert.equal(await statusWithHost(port, `127.0.0.1:${port}`), 200);
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
