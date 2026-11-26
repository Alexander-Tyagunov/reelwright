/**
 * @fileoverview Reelwright command-line entry. Usage:
 * `node reel.ts <command> [film.json] [options]`.
 *
 * Needs Node 24 or newer, which runs TypeScript directly by removing types.
 * A `UserError` prints its message and exits with code 1. An unknown
 * command or an old Node version exits with code 2.
 */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PALETTE_NAMES} from './audio/palettes.ts';
import type {Args} from './core/args.ts';
import {isStopping} from './core/cleanup.ts';

const MIN_NODE_MAJOR = 24;

/** Command names with a one-line help text each. */
const COMMANDS: Readonly<Record<string, string>> = {
  doctor: 'check Node, ffmpeg and a browser are available',
  init:
    'create a film project from a template: init <dir> ' +
    '[--template release|metrics|explainer|blank] [--size WxH]',
  scenes:
    'list the scene types and their fields [--json | --md] ' +
    '(--md prints references/scenes.md)',
  preview:
    'serve the film with a scrubbing player: preview film.json [--port N]',
  stills:
    'draw full-size stills and a contact sheet: stills film.json ' +
    '[--at 1.5,3] [--every S --from S --to S] [--size WxH]',
  render:
    'render the film to MP4, scene by scene, reusing unchanged scenes: ' +
    'render film.json [--size WxH] [--draft] [--no-sound]',
  qa:
    'measure the film against the motion and layout gates: qa film.json ' +
    '[--page-only | --video out/film.mp4] [--size WxH]',
  sound:
    'generate background sound for a film: sound film.json [--size WxH] ' +
    `[--palette ${PALETTE_NAMES.join('|')}]`,
  export:
    'make platform files (mp4, gif, webm, poster) with optional audio: ' +
    'export film.json --preset master|x|linkedin|youtube|slack|web|gif|webm',
  plate:
    'check a plate folder: plate plates/shot03/tracks.json ' +
    '(tracks, events, frame files, frame size)',
  build: 'bundle the film into one self-contained HTML file: build film.json',
};

function printHelp(): void {
  const lines = Object.entries(COMMANDS).map(
    ([name, help]) => `  ${name.padEnd(8)} ${help}`,
  );
  const usage = 'Usage: node reel.ts <command> [film.json] [options]';
  console.log(`Reelwright\n\n${usage}\n\n${lines.join('\n')}`);
}

type CommandModule = {
  run?: (args: Args) => Promise<number>;
};

async function runCommand(name: string, rest: string[]): Promise<number> {
  const file = join(import.meta.dirname, 'commands', `${name}.ts`);
  if (!existsSync(file)) {
    console.error(
      `the "${name}" command is not installed in this copy of Reelwright.`,
    );
    return 2;
  }
  const {parseArgs} = await import('./core/args.ts');
  const {UserError} = await import('./core/errors.ts');
  try {
    const mod = (await import(pathToFileURL(file).href)) as CommandModule;
    if (typeof mod.run !== 'function') {
      throw new Error(`commands/${name}.ts does not export run()`);
    }
    return (await mod.run(parseArgs(rest))) ?? 0;
  } catch (e) {
    if (isStopping()) {
      return 1;
    }
    if (e instanceof UserError) {
      console.error(`error: ${e.message}`);
      return 1;
    }
    console.error(e instanceof Error ? (e.stack ?? e.message) : e);
    return 1;
  }
}

async function main(): Promise<number> {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE_MAJOR) {
    console.error(
      `Reelwright needs Node ${MIN_NODE_MAJOR} or newer ` +
        `(found ${process.versions.node}). ` +
        'Install it from nodejs.org, then run the command again.',
    );
    return 2;
  }
  const [name, ...rest] = process.argv.slice(2);
  if (!name || name === 'help' || name === '--help') {
    printHelp();
    return 0;
  }
  if (!Object.hasOwn(COMMANDS, name)) {
    console.error(
      `unknown command "${name}". Run with no arguments to list commands.`,
    );
    return 2;
  }
  return runCommand(name, rest);
}

process.exit(await main());
