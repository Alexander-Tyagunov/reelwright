/**
 * @fileoverview `assemble`: writes a film spec from a shot plan, the plates
 * beside the film and the optional files beside the plan.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {Args} from '../core/args.ts';
import {stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {assemble} from '../plan/assemble.ts';
import {filmRoot, loadPlan, loadSideFiles} from '../plan/load.ts';

function shotIds(text: string | undefined): string[] | null {
  if (text === undefined || text === 'all') {
    return null;
  }
  const ids = text
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!ids.length) {
    throw new UserError('--shots needs shot ids such as A1,A2, or "all"');
  }
  return ids;
}

/**
 * Writes the film spec for a plan and prints its length and any warnings.
 *
 * Plate folders and `--intro` and `--outro` are relative to the film folder,
 * which is `--root`; by default it is the folder above a plan folder called
 * `plan`, otherwise the plan's own folder (the rule of `reel plan`). The
 * plate paths in the spec are written relative to the folder of `--out`. A
 * second format reads plates from `<folder>@9x16`. Side files are read from
 * the plan's folder.
 *
 * @param args `assemble plan.json --out film.json [--shots A1,A2|all]
 *   [--format 16:9] [--intro plates/A0] [--outro plates/Z0] [--no-sound]
 *   [--root DIR]`.
 * @returns 0 when the spec was written.
 * @throws UserError for a missing plan or `--out`, an unknown shot or format,
 *   an intro or outro plate that has no usable `tracks.json`, or an intro or
 *   outro whose id is also a shot's.
 */
export async function run(args: Args): Promise<number> {
  const {abs, dir, plan} = loadPlan(args.positional[0]);
  const given = stringFlag(args, 'out');
  if (!given) {
    throw new UserError('missing --out, e.g. --out film.json');
  }
  const out = resolve(given);
  const {spec, warnings} = assemble(plan, loadSideFiles(dir), {
    shots: shotIds(stringFlag(args, 'shots')),
    format: stringFlag(args, 'format'),
    intro: stringFlag(args, 'intro'),
    outro: stringFlag(args, 'outro'),
    noSound: args.flags.sound === false,
    root: filmRoot(dir, stringFlag(args, 'root')),
    specDir: dirname(out),
  });
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`);
  const seconds = spec.scenes.reduce((t, s) => t + s.duration, 0);
  console.log(
    `wrote ${out} from ${abs}: ${spec.scenes.length} scenes, ` +
      `${seconds.toFixed(3)} s`,
  );
  for (const w of warnings) {
    console.log(`WARN ${w}`);
  }
  return 0;
}
