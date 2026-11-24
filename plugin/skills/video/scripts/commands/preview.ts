/**
 * @fileoverview `preview`: serves the film with a scrubbing player.
 */

import type {Args} from '../core/args.ts';
import {numberFlag, stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {loadSpec} from '../core/spec.ts';
import type {FilmServer} from '../server/server.ts';
import {serve} from '../server/server.ts';

const DEFAULT_PORT = 4173;

async function start(
  specPath: string,
  projectDir: string,
  port: number,
): Promise<FilmServer> {
  try {
    return await serve({specPath, projectDir, port});
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'EADDRINUSE') {
      throw new UserError(`port ${port} is in use. Pick another with --port.`);
    }
    throw e;
  }
}

/**
 * Serves the film on 127.0.0.1 and waits for Ctrl+C. Reload the page after
 * editing the spec.
 *
 * @param args `preview film.json [--port N] [--size WxH]`. Default port 4173.
 * @returns 0 after the server stops.
 */
export async function run(args: Args): Promise<number> {
  const spec = loadSpec(args.positional[0]);
  const port = numberFlag(args, 'port', 'a port number') ?? DEFAULT_PORT;
  const server = await start(spec.abs, spec.dir, port);
  const size = stringFlag(args, 'size');
  console.log(`preview: ${server.url}${size ? `?size=${size}` : ''}`);
  console.log('Reload the page after editing the spec. Press Ctrl+C to stop.');
  await new Promise(resolve => process.on('SIGINT', resolve));
  await server.close();
  return 0;
}
