/**
 * @fileoverview Film projects in temporary folders, and readers for the
 * files the commands write.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {
  GateResult,
  QaReport,
} from '../../plugin/skills/video/scripts/qa/report.ts';
import type {FilmSpec} from '../../plugin/skills/video/scripts/shared/contract.ts';
import type {CliResult} from './cli.ts';
import {reel} from './cli.ts';
import {removeDir, tempDir} from './tmp.ts';

/** A film project folder. */
export interface Project {
  /** Absolute project folder. */
  dir: string;
  /** Absolute path of `film.json`. */
  spec: string;
}

/** A report and the exit code of the command that wrote it. */
export interface QaRun {
  code: number | null;
  report: QaReport;
  output: string;
}

/** Frame size used by most films in these tests, in pixels. */
export const SMALL = {width: 1280, height: 720, fps: 30} as const;

/** A temporary folder that holds projects and is removed at the end. */
export interface Workspace {
  root: string;
  /**
   * Writes a project: `film.json` and the project scene files. The spec's
   * `customScenes` list is set from the file names.
   *
   * @param scenes Source text by file name, written to `scenes/`.
   */
  project(
    name: string,
    film: FilmSpec,
    scenes?: Record<string, string>,
  ): Project;
  /** Removes the folder. */
  dispose(): void;
}

/** Creates a workspace. Call `dispose` in an `after` hook. */
export function workspace(): Workspace {
  const root = tempDir('reel-e2e-');
  return {
    root,
    project(name, film, scenes = {}) {
      const dir = join(root, name);
      mkdirSync(join(dir, 'scenes'), {recursive: true});
      const names = Object.keys(scenes);
      const spec: FilmSpec = names.length
        ? {...film, customScenes: names.map(f => `scenes/${f}`)}
        : film;
      for (const [file, code] of Object.entries(scenes)) {
        writeFileSync(join(dir, 'scenes', file), code);
      }
      const path = join(dir, 'film.json');
      writeFileSync(path, JSON.stringify(spec, null, 2));
      return {dir, spec: path};
    },
    dispose: () => removeDir(root),
  };
}

/**
 * Reads `out/qa-report<suffix>.json` of a project.
 *
 * @param suffix For example `-1080x1350`.
 */
export function readReport(dir: string, suffix = ''): QaReport {
  const path = join(dir, 'out', `qa-report${suffix}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as QaReport;
}

/** Finds a gate in a report. A missing gate fails the test with its name. */
export function gateOf(report: QaReport, id: GateResult['id']): GateResult {
  const gate = report.gates.find(g => g.id === id);
  if (!gate) {
    throw new Error(
      `the report has no ${id} gate: ${JSON.stringify(report.gates.map(g => g.id))}`,
    );
  }
  return gate;
}

/** First `FAIL` or `WARN` detail of a gate that matches, or an empty text. */
export function detail(gate: GateResult, pattern: RegExp): string {
  return gate.details.find(d => pattern.test(d)) ?? '';
}

/**
 * Runs `qa` and reads the report it wrote.
 *
 * @param extra Flags after the spec, such as `--page-only`.
 * @param suffix Report file suffix, such as `-1080x1350` for `--size`.
 */
export async function qa(
  project: Project,
  extra: string[] = [],
  suffix = '',
): Promise<QaRun> {
  const {code, output} = await reel(project.dir, [
    'qa',
    project.spec,
    ...extra,
  ]);
  return {code, report: readReport(project.dir, suffix), output};
}

/**
 * Renders a project and fails with the command output when it does not
 * succeed.
 */
export async function render(
  project: Project,
  extra: string[] = [],
): Promise<CliResult> {
  const result = await reel(project.dir, ['render', project.spec, ...extra]);
  if (result.code !== 0) {
    throw new Error(
      `render failed (exit ${result.code}):\n${result.output.slice(-1500)}`,
    );
  }
  return result;
}

/** True when a path exists. */
export function exists(path: string): boolean {
  return existsSync(path);
}
