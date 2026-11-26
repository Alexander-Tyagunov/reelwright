/**
 * @fileoverview Fingerprints of what a render depends on besides the spec
 * text: project files and the runtime.
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import type {FilmSpec} from '../shared/contract.ts';
import {runtimeHash, sha1} from './hash.ts';
import {plateFingerprints} from './plate-stamp.ts';

/** Files up to this size, in bytes, are hashed by content. */
const SMALL_FILE_BYTES = 256 * 1024;

/** Project folders whose files always count. */
const PROJECT_FOLDERS = ['assets', 'vendor', 'scenes', 'fonts'];

function isExternal(text: string): boolean {
  return /^(https?:|data:|\/\/)/i.test(text);
}

function fileEntry(dir: string, path: string): string {
  const st = statSync(path);
  const rel = relative(dir, path);
  if (st.size <= SMALL_FILE_BYTES) {
    return `${rel}:${sha1(readFileSync(path))}`;
  }
  return `${rel}:${st.size}:${st.mtimeMs}`;
}

function walkFolder(folder: string, visit: (path: string) => void): void {
  if (!existsSync(folder)) {
    return;
  }
  for (const name of readdirSync(folder).sort()) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      walkFolder(path, visit);
    } else {
      visit(path);
    }
  }
}

function isInsideFile(dir: string, text: string): string | null {
  if (!text || text.length > 500 || isExternal(text)) {
    return null;
  }
  try {
    const path = resolve(dir, text.startsWith('/') ? `.${text}` : text);
    const inside = path === dir || path.startsWith(dir + sep);
    return inside && existsSync(path) && statSync(path).isFile() ? path : null;
  } catch {
    return null;
  }
}

function visitStrings(value: unknown, visit: (text: string) => void): void {
  if (typeof value === 'string') {
    visit(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      visitStrings(item, visit);
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      visitStrings(item, visit);
    }
  }
}

/** The film without the plate paths, which have their own fingerprint. */
function withoutPlates(film: FilmSpec): FilmSpec {
  const scenes = film.scenes.map(s => {
    const {plate: _plate, ...rest} = s;
    return s.type === 'plate' ? (rest as typeof s) : s;
  });
  return {...film, scenes};
}

/**
 * Fingerprint of the project files a film can use: the `assets`, `vendor`,
 * `scenes` and `fonts` folders, the custom scene files, and every string in
 * the spec that names a file inside the project folder. Plates are left out:
 * each plate scene has its own fingerprint, so changing one plate does not
 * invalidate the other scenes.
 *
 * @param dir Absolute project folder.
 * @returns 40 hex characters.
 */
export function projectStamp(dir: string, film: FilmSpec): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  const add = (path: string): void => {
    if (!seen.has(path)) {
      seen.add(path);
      parts.push(fileEntry(dir, path));
    }
  };
  for (const sub of PROJECT_FOLDERS) {
    walkFolder(join(dir, sub), add);
  }
  for (const scene of film.customScenes ?? []) {
    const path = resolve(dir, scene);
    if (existsSync(path) && statSync(path).isFile()) {
      add(path);
    }
  }
  visitStrings(withoutPlates(film), text => {
    const path = isInsideFile(dir, text);
    if (path) {
      add(path);
    }
  });
  return sha1(parts.sort().join('|'));
}

/**
 * Fingerprint of a whole render input: the spec file bytes, the runtime and
 * the project stamp. `render` stores it and `qa` recomputes it to detect a
 * video that is older than its spec.
 *
 * @param specAbs Absolute path of the spec file.
 * @param dir Absolute project folder.
 */
export function specHash(specAbs: string, dir: string, film: FilmSpec): string {
  return sha1(
    readFileSync(specAbs),
    runtimeHash(),
    projectStamp(dir, film),
    plateFingerprints(dir, film),
  );
}
