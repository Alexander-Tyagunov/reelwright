/**
 * @fileoverview Temporary folders for tests. Each test makes its own and
 * removes it when done.
 */
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';

/** Creates an empty folder under the system temp folder. */
export function tempDir(prefix = 'reel-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Removes a folder and everything in it. */
export function removeDir(dir: string): void {
  rmSync(dir, {recursive: true, force: true});
}

/**
 * Writes a file, creating its folders.
 *
 * @param root Folder that holds the file.
 * @param rel Path of the file below `root`.
 */
export function put(root: string, rel: string, content: string): string {
  const path = join(root, rel);
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, content);
  return path;
}
