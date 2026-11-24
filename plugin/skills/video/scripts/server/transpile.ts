/**
 * @fileoverview Turns TypeScript files into JavaScript for the browser by
 * removing types. Nothing is compiled: the output has the same line numbers.
 */
import {readFileSync, statSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

interface CacheEntry {
  mtimeMs: number;
  code: string;
}

const cache = new Map<string, CacheEntry>();

/**
 * Removes the types from TypeScript source.
 *
 * @param source TypeScript text. It must use erasable syntax only.
 * @param filename Name shown in error messages.
 * @returns JavaScript text.
 * @throws Error when the source uses syntax that cannot be erased, such as
 *   an enum.
 */
export function stripTypes(source: string, filename: string): string {
  const emitWarning = process.emitWarning;
  // Node prints a one-time experimental notice for this call. Hide it.
  process.emitWarning = () => {};
  try {
    return stripTypeScriptTypes(source, {mode: 'strip'});
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(`${filename}: ${why}`);
  } finally {
    process.emitWarning = emitWarning;
  }
}

/**
 * Reads a `.ts` file and returns it as JavaScript. The result is cached
 * until the file's modification time changes.
 *
 * @param path Absolute path of the file.
 */
export function transpileFile(path: string): string {
  const mtimeMs = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtimeMs === mtimeMs) {
    return hit.code;
  }
  const code = stripTypes(readFileSync(path, 'utf8'), path);
  cache.set(path, {mtimeMs, code});
  return code;
}
