/**
 * @fileoverview Static server for one film. It binds to 127.0.0.1 and serves
 * only the runtime, the shared types and the project folder. It refuses a
 * request whose Host is not this server, any path segment that starts with a
 * dot, and any file that a link points to outside the allowed folders.
 *
 * Routes: `/` is the film page; `/__reel/runtime/*` and `/__reel/shared/*`
 * map to the engine's `runtime` and `shared` folders; `/__film.json` is the
 * spec, read fresh on each request; anything else is a file in the project
 * folder. Files ending in `.ts` are served as type-stripped JavaScript.
 */

import {existsSync, readFileSync, realpathSync, statSync} from 'node:fs';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {createServer} from 'node:http';
import {extname, join, normalize, resolve, sep} from 'node:path';
import {onStop} from '../core/cleanup.ts';
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
  /** Base address with a trailing slash, such as `http://127.0.0.1:4173/`. */
  url: string;
  /** The address the socket is bound to, as the operating system reports. */
  boundAddress: string;
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

/** A file path and the folder it must stay inside. */
interface Target {
  file: string;
  root: string;
}

function resolveFile(pathname: string, projectDir: string): Target | null {
  for (const [prefix, root] of Object.entries(ENGINE_ROUTES)) {
    if (pathname.startsWith(prefix)) {
      const file = safeJoin(root, pathname.slice(prefix.length - 1));
      return file ? {file, root} : null;
    }
  }
  if (pathname.startsWith('/__reel/')) {
    return null;
  }
  const file = safeJoin(projectDir, pathname);
  return file ? {file, root: projectDir} : null;
}

/** True when a path has a segment such as `.env` or `.git`. */
function hasDotSegment(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return decoded.split(/[\\/]/).some(part => part.startsWith('.'));
}

/** The real path of a served file, or null when a link leaves its root. */
function realFile({file, root}: Target): string | null {
  if (!existsSync(file)) {
    return null;
  }
  const real = realpathSync(file);
  const base = realpathSync(root);
  const inside = real === base || real.startsWith(base + sep);
  return inside && statSync(real).isFile() ? real : null;
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

function sendProjectFile(
  res: ServerResponse,
  path: string,
  projectDir: string,
): void {
  const target = hasDotSegment(path) ? null : resolveFile(path, projectDir);
  const file = target ? realFile(target) : null;
  if (file) {
    sendFile(res, file);
  } else {
    send(res, 404, `not found: ${path}`);
  }
}

function route(
  req: IncomingMessage,
  res: ServerResponse,
  options: ServeOptions,
  hosts: Set<string>,
): void {
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (!hosts.has(req.headers.host ?? '')) {
    send(res, 403, 'forbidden: unknown Host header');
  } else if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'method not allowed');
  } else if (path === '/' || path === '/index.html') {
    send(res, 200, readFileSync(join(RUNTIME_DIR, 'film.html')), MIME['.html']);
  } else if (path === '/favicon.ico') {
    res.writeHead(204);
    res.end();
  } else if (path === '/__film.json') {
    send(res, 200, readFileSync(options.specPath), MIME['.json']);
  } else {
    sendProjectFile(res, path, options.projectDir);
  }
}

/**
 * Starts the server on 127.0.0.1.
 *
 * @returns Once the server is listening.
 * @throws Error when the port is taken.
 */
export function serve(options: ServeOptions): Promise<FilmServer> {
  const hosts = new Set<string>();
  const server = createServer((req, res) => {
    try {
      route(req, res, options, hosts);
    } catch (e) {
      send(res, 500, e instanceof Error ? e.message : String(e));
    }
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const address = server.address();
      const bound = typeof address === 'object' && address ? address : null;
      const port = bound?.port ?? 0;
      hosts.add(`127.0.0.1:${port}`).add(`localhost:${port}`);
      const stop = (): Promise<void> =>
        new Promise<void>(done => {
          server.closeAllConnections();
          server.close(() => done());
        });
      const forget = onStop(stop);
      resolvePromise({
        url: `http://127.0.0.1:${port}/`,
        boundAddress: bound?.address ?? '',
        close: () => {
          forget();
          return stop();
        },
      });
    });
  });
}
