/**
 * @fileoverview `preview`: serves the film with a scrubbing player.
 */

import type {Args} from '../core/args.ts';
import {numberFlag, stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {frameSize, loadSpec} from '../core/spec.ts';
import {checkPort} from '../core/validate.ts';
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
 * editing the spec. Ctrl+C or SIGTERM stops the server and exits with 130 or
 * 143.
 *
 * @param args `preview film.json [--port N] [--size WxH]`. Default port 4173.
 * @returns Never: the process exits when it is stopped.
 * @throws UserError when the port is not 0 to 65535 or is in use.
 */
export async function run(args: Args): Promise<number> {
  const spec = loadSpec(args.positional[0]);
  const asked = numberFlag(args, 'port', 'a port number');
  const port = checkPort('--port', asked ?? DEFAULT_PORT);
  const size = stringFlag(args, 'size');
  frameSize(spec.film, size);
  const server = await start(spec.abs, spec.dir, port);
  console.log(`preview: ${server.url}${size ? `?size=${size}` : ''}`);
  console.log('Reload the page after editing the spec. Press Ctrl+C to stop.');
  // The stop registry closes the server on Ctrl+C and exits with 130.
  await new Promise<void>(() => {});
  return 0;
}
