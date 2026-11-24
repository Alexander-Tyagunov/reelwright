/**
 * @fileoverview Static server for one film. It binds to 127.0.0.1 and serves
 * only the runtime, the shared types and the project folder.
 *
 * Routes: `/` is the film page; `/__reel/runtime/*` and `/__reel/shared/*`
 * map to the engine's `runtime` and `shared` folders; `/__film.json` is the
 * spec, read fresh on each request; anything else is a file in the project
 * folder. Files ending in `.ts` are served as type-stripped JavaScript.
 */

import {existsSync, readFileSync, statSync} from 'node:fs';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {createServer} from 'node:http';
import {extname, join, normalize, resolve, sep} from 'node:path';
import {RUNTIME_DIR, SHARED_DIR} from '../core/paths.ts';
import {transpileFile} from './transpile.ts';

/** Options for {@link serve}. */
export interface ServeOptions {
  /** Absolute path of the spec file served as `/__film.json`. */
  specPath: string;
  /** Absolute project folder. */
  projectDir: string;
  /** TCP port. 0 picks a free one. Default 0. */
  port?: number;
}

/** A running server. */
export interface FilmServer {
  /** Base address with a trailing slash, for example `http://127.0.0.1:4173/`. */
  url: string;
  /** Stops listening and drops open connections. */
  close(): Promise<void>;
}

const JS = 'text/javascript; charset=utf-8';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': JS,
  '.mjs': JS,
  '.ts': JS,
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};

const ENGINE_ROUTES: Record<string, string> = {
  '/__reel/runtime/': RUNTIME_DIR,
  '/__reel/shared/': SHARED_DIR,
};

/** Joins a URL path onto a root. Returns null when it would leave the root. */
function safeJoin(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) {
    return null;
  }
  const path = resolve(root, `.${normalize(`/${decoded}`)}`);
  return path === root || path.startsWith(root + sep) ? path : null;
}

function resolveFile(pathname: string, projectDir: string): string | null {
  for (const [prefix, root] of Object.entries(ENGINE_ROUTES)) {
    if (pathname.startsWith(prefix)) {
      return safeJoin(root, pathname.slice(prefix.length - 1));
    }
  }
  if (pathname.startsWith('/__reel/')) {
    return null;
  }
  return safeJoin(projectDir, pathname);
}

function send(
  res: ServerResponse,
  code: number,
  body: string | Buffer,
  type = 'text/plain; charset=utf-8',
): void {
  res.writeHead(code, {'content-type': type, 'cache-control': 'no-store'});
  res.end(body);
}

function sendFile(res: ServerResponse, file: string): void {
  const ext = extname(file).toLowerCase();
  if (ext === '.ts') {
    send(res, 200, transpileFile(file), JS);
    return;
  }
  const type = MIME[ext] ?? 'application/octet-stream';
  send(res, 200, readFileSync(file), type);
}

function route(
  req: IncomingMessage,
  res: ServerResponse,
  options: ServeOptions,
): void {
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'method not allowed');
  } else if (path === '/' || path === '/index.html') {
    send(res, 200, readFileSync(join(RUNTIME_DIR, 'film.html')), MIME['.html']);
  } else if (path === '/favicon.ico') {
    res.writeHead(204);
    res.end();
  } else if (path === '/__film.json') {
    send(res, 200, readFileSync(options.specPath), MIME['.json']);
  } else {
    const file = resolveFile(path, options.projectDir);
    if (file && existsSync(file) && statSync(file).isFile()) {
      sendFile(res, file);
    } else {
      send(res, 404, `not found: ${path}`);
    }
  }
}

/**
 * Starts the server on 127.0.0.1.
 *
 * @returns Once the server is listening.
 * @throws Error when the port is taken.
 */
export function serve(options: ServeOptions): Promise<FilmServer> {
  const server = createServer((req, res) => {
    try {
      route(req, res, options);
    } catch (e) {
      send(res, 500, e instanceof Error ? e.message : String(e));
    }
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolvePromise({
        url: `http://127.0.0.1:${port}/`,
        close: () =>
          new Promise<void>(done => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}
