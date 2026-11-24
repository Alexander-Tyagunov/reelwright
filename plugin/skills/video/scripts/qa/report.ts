/**
 * @fileoverview Types of a gate result and of the whole report, the verdict
 * rules, the printed table and the report file.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {table} from '../core/table.ts';
import type {Freeze} from './freezes.ts';
import {SPARK_LEGEND} from './sparkline.ts';

/** Names of the gates, in the order they run. */
export type GateId =
  | 'load'
  | 'determinism'
  | 'layout'
  | 'holds'
  | 'pacing'
  | 'probe'
  | 'motion'
  | 'audio';

/** Outcome of one gate. `SKIP` means the gate had nothing to measure. */
export type GateStatus = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';

/** Outcome of the whole run. `incomplete` means no video was checked. */
export type Verdict = 'pass' | 'warn' | 'fail' | 'incomplete';

/** Numbers the motion gate adds to its result. */
export interface MotionStats {
  /** Grey levels below which a frame is unchanged. */
  freezeThreshold: number;
  /** Still seconds divided by film seconds, 0 to 1. */
  frozenRatio: number;
  /** Frames decoded. */
  frames: number;
}

/** Result of one gate. */
export interface GateResult {
  id: GateId;
  status: GateStatus;
  /** One line with the measured numbers. */
  summary: string;
  /** Lines that start with `FAIL`, `WARN` or `info`. */
  details: string[];
  /** Motion picture rows. Only the motion gate sets it. */
  sparkline?: string[];
  freezes?: Freeze[];
  stats?: MotionStats;
}

/** The film facts stored in the report. */
export interface FilmSummary {
  title: string;
  /** Pixels. */
  width: number;
  height: number;
  fps: number;
  /** Seconds. */
  duration: number;
  frames: number;
  scenes: number;
  loop: boolean;
  /** Absolute spec path, or null when only a video was checked. */
  spec: string | null;
}

/** The document written to `out/qa-report*.json`. */
export interface QaReport {
  film: FilmSummary | Record<string, never>;
  /** Absolute path of the video that was checked, or null. */
  video: string | null;
  note?: string;
  gates: GateResult[];
  verdict: Verdict;
}

/** A list of findings with the worst status among them. */
export interface Findings {
  status: GateStatus;
  details: string[];
  /** Records a `WARN` or `FAIL` line and raises the status. */
  add(status: 'WARN' | 'FAIL', message: string): void;
}

const ORDER: readonly GateStatus[] = ['SKIP', 'PASS', 'WARN', 'FAIL'];

/** Returns the more severe of two statuses. */
export function worst(a: GateStatus, b: GateStatus): GateStatus {
  return ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a;
}

/** Starts an empty list of findings with status `PASS`. */
export function findings(): Findings {
  const list: Findings = {
    status: 'PASS',
    details: [],
    add(status, message) {
      list.status = worst(list.status, status);
      list.details.push(`${status} ${message}`);
    },
  };
  return list;
}

/**
 * Builds the result of a gate that threw. The gate is a failure, so a broken
 * gate never lets a film pass. The result carries the message, not the stack.
 */
export function crashedGate(id: GateId, error: unknown): GateResult {
  const message = String(error instanceof Error ? error.message : error);
  return {
    id,
    status: 'FAIL',
    summary: `gate crashed: ${message.split('\n')[0]}`,
    details: [`FAIL ${message.slice(0, 900)}`],
  };
}

/**
 * Decides the verdict: any failed gate fails the run; otherwise a run without
 * a video is incomplete; otherwise any warning warns.
 */
export function verdictOf(
  gates: readonly GateResult[],
  incomplete: boolean,
): Verdict {
  if (gates.some(g => g.status === 'FAIL')) {
    return 'fail';
  }
  if (incomplete) {
    return 'incomplete';
  }
  return gates.some(g => g.status === 'WARN') ? 'warn' : 'pass';
}

/**
 * Process exit code for a verdict: 1 for `fail` and `incomplete`, and for
 * `warn` when `strict` is set; otherwise 0.
 */
export function exitCodeFor(verdict: Verdict, strict: boolean): number {
  const bad = verdict === 'fail' || verdict === 'incomplete';
  return bad || (verdict === 'warn' && strict) ? 1 : 0;
}

/** Picks the fields of a gate that go into the report file. */
function publicGate(g: GateResult): GateResult {
  const base: GateResult = {
    id: g.id,
    status: g.status,
    summary: g.summary,
    details: g.details,
  };
  return g.sparkline
    ? {...base, sparkline: g.sparkline, freezes: g.freezes, stats: g.stats}
    : base;
}

/** Inputs of {@link buildReport}. */
export interface ReportParts {
  film: QaReport['film'];
  video: string | null;
  gates: GateResult[];
  incomplete: boolean;
  pageOnly: boolean;
}

/** Assembles the report document and its verdict and note. */
export function buildReport(parts: ReportParts): QaReport {
  const verdict = verdictOf(parts.gates, parts.incomplete);
  let note: string | undefined;
  if (parts.pageOnly) {
    note = 'page gates only; render and run qa again for the video gates';
  } else if (verdict === 'incomplete') {
    note = 'run render, then qa again';
  }
  return {
    film: parts.film,
    video: parts.video,
    ...(note ? {note} : {}),
    gates: parts.gates.map(publicGate),
    verdict,
  };
}

/**
 * Writes the report as pretty JSON to `qa-report<suffix>.json`.
 *
 * @param dir Folder, created when missing.
 * @param suffix Text after `qa-report`, for example `-1080x1350`.
 * @returns The absolute path of the file.
 */
export function writeReportFile(
  dir: string,
  suffix: string,
  report: QaReport,
): string {
  mkdirSync(dir, {recursive: true});
  const path = join(dir, `qa-report${suffix}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  return path;
}

/**
 * Lays the report out for a terminal: the gate table, the motion picture,
 * every warning and failure, and the verdict line.
 *
 * @param file Path of the report file to mention, or null.
 */
export function formatReport(report: QaReport, file: string | null): string {
  const rows = report.gates.map(g => [g.id, g.status, g.summary]);
  const out = [table([['gate', 'status', 'summary'], ...rows])];
  for (const g of report.gates) {
    if (g.id === 'motion' && g.sparkline) {
      const head = `motion per 0.5 s (mean frame difference; ${SPARK_LEGEND})`;
      out.push(`\n${head}\n${g.sparkline.join('\n')}`);
    }
    const lines = g.details.filter(d => /^(WARN|FAIL)/.test(d));
    if (lines.length) {
      out.push(
        `\n${g.id} ${g.status}:\n${lines.map(l => `  ${l}`).join('\n')}`,
      );
    }
  }
  const note = report.note ? ` (${report.note})` : '';
  const where = file ? `  (report: ${file})` : '';
  out.push(`\nverdict: ${report.verdict.toUpperCase()}${note}${where}`);
  return out.join('\n');
}
