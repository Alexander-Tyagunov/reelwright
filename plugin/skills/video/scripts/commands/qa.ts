/**
 * @fileoverview `qa`: measures a film or a video against the quality gates
 * and prints a verdict. It reports numbers, not opinions.
 */
import type {Args} from '../core/args.ts';
import {readOptions} from '../qa/options.ts';
import {exitCodeFor, formatReport, writeReportFile} from '../qa/report.ts';
import {qaFilm} from '../qa/run-film.ts';
import type {QaOutcome} from '../qa/run-video.ts';
import {qaVideoFile} from '../qa/run-video.ts';

function emit(outcome: QaOutcome, json: boolean): void {
  const {report, dir, suffix} = outcome;
  const file = dir ? writeReportFile(dir, suffix, report) : null;
  console.log(
    json ? JSON.stringify(report, null, 2) : formatReport(report, file),
  );
}

/**
 * Runs the quality gates and returns the exit code.
 *
 * With a spec: load, determinism, layout, holds and pacing, then probe,
 * motion and audio on `out/film[-WxH].mp4` or `--video`. Without a spec but
 * with `--video`: probe, motion and audio on that file alone.
 *
 * Verdicts: `pass`, `warn`, `fail`, `incomplete` (no video was checked).
 * The report is also written to `out/qa-report[-WxH].json`.
 *
 * @param args `qa [film.json] [--size WxH] [--video file.mp4] [--page-only]
 *   [--strict] [--json] [--loop] [--max-hold S] [--gpu]`.
 * @returns 1 for `fail` and `incomplete`, and for `warn` with `--strict`;
 *   otherwise 0.
 * @throws UserError when a flag has no value.
 */
export async function run(args: Args): Promise<number> {
  const options = readOptions(args);
  const spec = args.positional[0];
  const outcome =
    !spec && options.video
      ? await qaVideoFile(options)
      : await qaFilm(spec, options);
  emit(outcome, options.json);
  return exitCodeFor(outcome.report.verdict, options.strict);
}
