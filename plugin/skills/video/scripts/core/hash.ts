/**
 * @fileoverview Content hashes used for render cache keys and stale checks.
 */
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {RUNTIME_DIR, SHARED_DIR} from './paths.ts';

/**
 * SHA-1 of the given parts, as 40 hex characters. Text and bytes are hashed
 * as they are. Any other value is hashed as its JSON text, so key order in
 * objects matters.
 */
export function sha1(...parts: unknown[]): string {
  const hash = createHash('sha1');
  for (const part of parts) {
    if (typeof part === 'string' || part instanceof Uint8Array) {
      hash.update(part);
    } else {
      hash.update(JSON.stringify(part) ?? 'undefined');
    }
  }
  return hash.digest('hex');
}

const HASHED = /\.(ts|js|css|html)$/;

function hashTree(hash: ReturnType<typeof createHash>, root: string): void {
  const walk = (dir: string): void => {
    const entries = readdirSync(dir, {withFileTypes: true});
    entries.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (HASHED.test(entry.name)) {
        hash.update(relative(root, path)).update(readFileSync(path));
      }
    }
  };
  walk(root);
}

/**
 * Hash of every browser-side source file: `runtime/` and `shared/`
 * (`.ts`, `.js`, `.css`, `.html`). A cached scene is stale when this
 * value changes.
 */
export function runtimeHash(): string {
  const hash = createHash('sha1');
  hashTree(hash, RUNTIME_DIR);
  hashTree(hash, SHARED_DIR);
  return hash.digest('hex');
}
