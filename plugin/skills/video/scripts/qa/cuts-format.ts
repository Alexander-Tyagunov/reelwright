/**
 * @fileoverview Prints the cut report as a table.
 */
import {table} from '../core/table.ts';
import type {CutReport} from './cuts.ts';

function timeText(seconds: number): string {
  return `${seconds.toFixed(2)} s`;
}

/**
 * Lays the cuts out for a terminal: one row per cut with the brightness
 * before and after, the change, and the loudness jump, then one line for
 * every cut that is flagged.
 */
export function formatCuts(cuts: readonly CutReport[]): string {
  if (!cuts.length) {
    return 'the film has one scene, so it has no cuts';
  }
  const rows = cuts.map(c => [
    timeText(c.at),
    `${c.from} -> ${c.to}`,
    `${c.before.toFixed(1)} -> ${c.after.toFixed(1)}`,
    `${c.after >= c.before ? '+' : '-'}${Math.round(c.change * 100)}%`,
    c.jump === null
      ? 'no audio'
      : `${c.jump >= 0 ? '+' : ''}${c.jump.toFixed(1)} LU`,
  ]);
  const head = ['cut at', 'scenes', 'brightness', 'change', 'loudness jump'];
  const out = [table([head, ...rows])];
  const flagged = cuts.filter(c => c.flags.length);
  for (const c of flagged) {
    out.push(
      `WARN ${timeText(c.at)} ${c.from} -> ${c.to}: ${c.flags.join('; ')}`,
    );
  }
  out.push(
    flagged.length
      ? `${flagged.length} of ${cuts.length} cuts flagged (a warning only)`
      : `${cuts.length} cuts, none flagged`,
  );
  return out.join('\n');
}
