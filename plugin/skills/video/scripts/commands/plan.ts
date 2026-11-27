/**
 * @fileoverview `plan`: checks a shot plan before any plate is rendered.
 */
import type {Args} from '../core/args.ts';
import {stringFlag} from '../core/args.ts';
import {checkPlan} from '../plan/checks.ts';
import {filmRoot, loadPlan} from '../plan/load.ts';

/**
 * Prints one line per check and exits 1 when any check fails. Warnings, such
 * as a plate that is not rendered yet, do not fail the plan.
 *
 * The film folder, where `plates/` is looked for, is `--root`; by default it
 * is the folder above a plan folder called `plan`, otherwise the plan's own
 * folder.
 *
 * @param args `plan plan/shots.json [--root DIR]`.
 * @returns 1 when a check fails, otherwise 0.
 * @throws UserError for a missing or unreadable plan, or a field the engine
 *   cannot use; the message lists up to 12 problems.
 */
export async function run(args: Args): Promise<number> {
  const {abs, dir, plan} = loadPlan(args.positional[0]);
  const root = filmRoot(dir, stringFlag(args, 'root'));
  const checks = checkPlan(plan, root);
  console.log(`plan: ${abs}`);
  checks.forEach((c, i) => {
    const note = c.status !== 'FAIL' && c.note ? `  (${c.note})` : '';
    console.log(`${c.status.padEnd(4)}  ${i + 1} ${c.name}${note}`);
    for (const p of c.problems.slice(0, 12)) {
      console.log(`        ${p}`);
    }
  });
  const failed = checks.filter(c => c.status === 'FAIL');
  console.log(
    failed.length
      ? `RESULT: FAIL: ${failed.map(c => c.name).join('; ')}`
      : 'RESULT: PASS (all checks)',
  );
  return failed.length ? 1 : 0;
}
