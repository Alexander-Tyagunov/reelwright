/**
 * @fileoverview `init`: creates a film project from a template folder.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import type {Args} from '../core/args.ts';
import {stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {REEL_ENTRY, TEMPLATES_DIR} from '../core/paths.ts';
import type {FrameSize} from '../core/spec.ts';
import {assertEvenSize, parseSize} from '../core/spec.ts';
import type {FilmSpec} from '../shared/contract.ts';

const USAGE =
  'usage: reel init <dir> [--template release|metrics|explainer|blank] ' +
  '[--size WxH]';

function listTemplates(): string[] {
  if (!existsSync(TEMPLATES_DIR)) {
    return [];
  }
  return readdirSync(TEMPLATES_DIR)
    .filter(d => existsSync(join(TEMPLATES_DIR, d, 'film.json')))
    .sort();
}

function templateName(args: Args): string {
  const value = args.flags.template;
  return value === undefined || value === true ? 'blank' : String(value);
}

function checkTarget(dir: string): void {
  const busy =
    existsSync(dir) &&
    (!statSync(dir).isDirectory() || readdirSync(dir).length);
  if (busy) {
    throw new UserError(
      `${dir} already exists and is not empty. Pick a new folder name.`,
    );
  }
}

function applySize(specPath: string, size: FrameSize): void {
  const film = JSON.parse(readFileSync(specPath, 'utf8')) as FilmSpec;
  film.meta = {...film.meta, ...size};
  writeFileSync(specPath, `${JSON.stringify(film, null, 2)}\n`);
}

function quote(path: string): string {
  return /\s/.test(path) ? `"${path}"` : path;
}

function printNext(dir: string, name: string, size: FrameSize | null): void {
  const rel = relative(process.cwd(), dir) || '.';
  const spec = quote(`${rel}/film.json`);
  const reel = `node ${quote(REEL_ENTRY)}`;
  const at = size ? ` at ${size.width}x${size.height}` : '';
  console.log(`created ${dir} from template "${name}"${at}`);
  console.log('\nNext:');
  console.log(`  ${reel} preview ${spec}     # scrub the film in a browser`);
  console.log(`  ${reel} stills ${spec}      # check the layout as stills`);
  console.log(`  ${reel} render ${spec}      # render out/film.mp4`);
  console.log(`  ${reel} export ${spec} --preset youtube`);
}

/**
 * Copies a template into a new folder, and sets the frame size when
 * `--size` is given.
 *
 * @param args `init <dir> [--template name] [--size WxH]`.
 * @returns 0 on success.
 * @throws UserError when the folder is missing from the command line, the
 *   template is unknown, the folder is not empty, or the size is invalid.
 */
export async function run(args: Args): Promise<number> {
  const target = args.positional[0];
  if (!target) {
    throw new UserError(USAGE);
  }
  const name = templateName(args);
  const src = join(TEMPLATES_DIR, name);
  if (!/^[\w-]+$/.test(name) || !existsSync(join(src, 'film.json'))) {
    const available = listTemplates().join(', ') || '(none found)';
    throw new UserError(
      `unknown template "${name}". Available templates: ${available}`,
    );
  }
  const dir = resolve(target);
  checkTarget(dir);
  const sizeText = stringFlag(args, 'size');
  const size = sizeText ? assertEvenSize(parseSize(sizeText)) : null;
  mkdirSync(dir, {recursive: true});
  cpSync(src, dir, {recursive: true});
  if (size) {
    applySize(join(dir, 'film.json'), size);
  }
  printNext(dir, name, size);
  return 0;
}
