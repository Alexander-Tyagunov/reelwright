/**
 * @fileoverview Collects the browser modules of a film and gives each one a
 * fixed key, so they can be listed in an import map. Types are stripped and
 * relative import specifiers are rewritten to keys.
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, relative, resolve, sep} from 'node:path';
import {UserError} from '../../core/errors.ts';
import {RUNTIME_DIR, SHARED_DIR} from '../../core/paths.ts';
import {stripTypes} from '../../server/transpile.ts';

/** One module ready for the import map. */
export interface ModuleEntry {
  /** Import map key, for example `reel:/runtime/math.ts`. */
  key: string;
  /** JavaScript source with import specifiers rewritten to keys. */
  code: string;
}

const SPECIFIER =
  /(\b(?:from|import)\s*\(?\s*)(['"])((?:\.{1,2}\/|\/__reel\/)[^'"\n]+)\2/g;

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...listTs(path));
    } else if (e.name.endsWith('.ts')) {
      out.push(path);
    }
  }
  return out.sort();
}

function toKey(prefix: string, root: string, file: string): string {
  return `reel:/${prefix}/${relative(root, file).split(sep).join('/')}`;
}

function rewrite(
  code: string,
  from: string,
  known: (key: string) => boolean,
): {code: string; deps: string[]} {
  const deps: string[] = [];
  const out = code.replace(SPECIFIER, (_all, head, quote, spec: string) => {
    const engine = spec.replace(/^\/__reel\//, 'reel:/');
    const key = new URL(spec.startsWith('/') ? engine : spec, from).href;
    if (!known(key) && !key.startsWith('reel:/project/')) {
      throw new UserError(`${from} imports "${spec}", which is not a module`);
    }
    deps.push(key);
    return `${head}${quote}${key}${quote}`;
  });
  return {code: out, deps};
}

/**
 * Every `.ts` file under `runtime/` and `shared/`, types stripped, imports
 * rewritten. Keys are `reel:/runtime/<path>` and `reel:/shared/<path>`.
 */
export function runtimeModules(): ModuleEntry[] {
  const files = [
    ...listTs(RUNTIME_DIR).map(f => ({
      key: toKey('runtime', RUNTIME_DIR, f),
      f,
    })),
    ...listTs(SHARED_DIR).map(f => ({key: toKey('shared', SHARED_DIR, f), f})),
  ];
  const keys = new Set(files.map(x => x.key));
  return files.map(({key, f}) => {
    const js = stripTypes(readFileSync(f, 'utf8'), f);
    return {key, code: rewrite(js, key, k => keys.has(k)).code};
  });
}

/** Result of {@link projectModules}. */
export interface ProjectModules {
  /** The modules, custom scene files first. */
  entries: ModuleEntry[];
  /** Keys of the custom scene files, in the spec's order. */
  sceneKeys: string[];
}

function projectFile(dir: string, rel: string, importer: string): string {
  const path = resolve(dir, rel);
  const inside = path.startsWith(dir + sep);
  if (!inside || !existsSync(path) || !statSync(path).isFile()) {
    throw new UserError(
      `custom scene script not found: ${path} (imported by ${importer})`,
    );
  }
  if (!['.ts', '.js', '.mjs'].includes(extname(path))) {
    throw new UserError(`custom scene scripts must be .ts or .js: ${path}`);
  }
  return path;
}

/**
 * Collects the project's custom scene files and the project modules they
 * import. Keys are `reel:/project/<path relative to the spec's folder>`.
 *
 * @param dir Absolute project folder.
 * @param scenes The spec's `customScenes` paths.
 * @throws UserError when a file is missing or is not `.ts`, `.js` or `.mjs`.
 */
export function projectModules(dir: string, scenes: string[]): ProjectModules {
  const entries = new Map<string, ModuleEntry>();
  const sceneKeys: string[] = [];
  const queue: Array<{rel: string; importer: string}> = scenes.map(rel => ({
    rel,
    importer: 'the spec',
  }));
  for (const first of scenes) {
    sceneKeys.push(toKey('project', dir, projectFile(dir, first, 'the spec')));
  }
  while (queue.length) {
    const {rel, importer} = queue.shift() ?? {rel: '', importer: ''};
    const path = projectFile(dir, rel, importer);
    const key = toKey('project', dir, path);
    if (entries.has(key)) {
      continue;
    }
    const source = readFileSync(path, 'utf8');
    const js = extname(path) === '.ts' ? stripTypes(source, path) : source;
    const known = (k: string): boolean => k.startsWith('reel:/');
    const {code, deps} = rewrite(js, key, known);
    entries.set(key, {key, code});
    for (const dep of deps.filter(d => d.startsWith('reel:/project/'))) {
      queue.push({rel: dep.slice('reel:/project/'.length), importer: key});
    }
  }
  return {entries: [...entries.values()], sceneKeys};
}
