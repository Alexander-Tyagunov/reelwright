/**
 * @fileoverview `scenes`: lists scene types by reading the header comment
 * of each file in `runtime/scenes/`.
 */
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Args} from '../core/args.ts';
import {boolFlag} from '../core/args.ts';
import {RUNTIME_DIR} from '../core/paths.ts';

/** One scene type as documented in its source file. */
export interface SceneDoc {
  /** The scene's `type` value in a spec. */
  type: string;
  /** One-line summary. */
  summary: string;
  /** One line per field the scene accepts. */
  fields: string[];
}

function commentLines(source: string): string[] {
  const m = source.match(/\/\*([\s\S]*?)\*\//);
  if (!m?.[1]) {
    return [];
  }
  const lines = m[1]
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*\*?\s?/, '').trimEnd());
  while (lines.length && !lines[0]?.trim()) {
    lines.shift();
  }
  return lines;
}

function describe(file: string, source: string): SceneDoc {
  const lines = commentLines(source);
  const first = (lines.shift() ?? '').replace(/^@fileoverview\s*/, '');
  const head = first.match(/^\s*(\S+?)\s+[—–-]+\s+(.*)$/);
  const fields = lines.map(l => l.trim()).filter(l => l && !l.startsWith('@'));
  if (head?.[1] && head[2] !== undefined) {
    return {type: head[1], summary: head[2].trim(), fields};
  }
  return {
    type: file.replace(/\.ts$/, ''),
    summary: '(no header comment)',
    fields,
  };
}

/**
 * Reads the scene catalogue from the runtime source.
 *
 * Each `runtime/scenes/<type>.ts` starts with a block comment. Its first
 * line reads `<type> — <summary>`. The lines after it list the fields.
 * `index.ts` and subfolders such as `lib/` are skipped.
 */
export function readScenes(): SceneDoc[] {
  const dir = join(RUNTIME_DIR, 'scenes');
  const files = readdirSync(dir, {withFileTypes: true})
    .filter(e => e.isFile() && e.name.endsWith('.ts') && e.name !== 'index.ts')
    .map(e => e.name)
    .sort();
  return files.map(f => describe(f, readFileSync(join(dir, f), 'utf8')));
}

/**
 * Prints the scene types and their fields, or JSON with `--json`.
 *
 * @returns 0.
 */
export async function run(args: Args): Promise<number> {
  const scenes = readScenes();
  if (boolFlag(args, 'json')) {
    console.log(JSON.stringify(scenes, null, 2));
    return 0;
  }
  console.log(`${scenes.length} scene types\n`);
  for (const s of scenes) {
    console.log(`${s.type} - ${s.summary}`);
    for (const line of s.fields) {
      console.log(`    ${line}`);
    }
    console.log();
  }
  return 0;
}
