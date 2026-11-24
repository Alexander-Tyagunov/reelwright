/**
 * @fileoverview Quality gates for a film spec: the page gates, then, when a
 * video exists, the probe, motion and audio gates.
 */
import {existsSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import type {OpenFilm} from '../browser/film.ts';
import {openFilm, pageErrors} from '../browser/film.ts';
import {UserError} from '../core/errors.ts';
import {loadSpec} from '../core/spec.ts';
import {specHash} from '../core/stamp.ts';
import type {StreamFacts} from '../video/probe.ts';
import {probeStreams} from '../video/probe.ts';
import {auditAudio} from './gates/audio.ts';
import {gateDeterminism} from './gates/determinism.ts';
import {gateHolds} from './gates/holds.ts';
import {gateLayout} from './gates/layout.ts';
import {
  applyDrawFailures,
  applyPageErrors,
  gateLoad,
  loadFailure,
} from './gates/load.ts';
import {gateMotion} from './gates/motion.ts';
import {gatePacing} from './gates/pacing.ts';
import {gateProbe, readRenderSummary, streamFps} from './gates/probe.ts';
import {guarded} from './guard.ts';
import {decodeMotion} from './motion-decode.ts';
import type {QaOptions} from './options.ts';
import type {FilmSummary, GateResult} from './report.ts';
import {buildReport} from './report.ts';
import type {QaOutcome} from './run-video.ts';
import {findDrawFailures} from './scene-draws.ts';

function sizeSuffix(options: QaOptions): string {
  return options.size ? `-${options.size}` : '';
}

/** Report file suffix: the video's name when `--video` is given. */
function reportSuffix(options: QaOptions): string {
  if (!options.video) {
    return sizeSuffix(options);
  }
  const name = basename(options.video).replace(/\.[^.]+$/, '');
  return `-${name}${sizeSuffix(options)}`;
}

/** Reads the probe gate's inputs and runs the gate. */
function probeGate(
  film: OpenFilm,
  video: string,
  stream: StreamFacts | undefined,
): GateResult {
  const {info, spec} = film;
  const summary = readRenderSummary(video);
  const currentHash = summary?.specHash
    ? specHash(spec.abs, spec.dir, spec.film)
    : null;
  const expected = {
    width: info.width,
    height: info.height,
    fps: info.fps,
    frames: info.frames,
  };
  return gateProbe({video, expected, summary, currentHash}, stream);
}

/** Runs the video gates on an existing file. */
async function videoGates(
  film: OpenFilm,
  video: string,
  gates: GateResult[],
): Promise<void> {
  const {info} = film;
  const streams = await probeStreams(video, ['-count_packets']).catch(
    () => null,
  );
  const stream = streams?.streams.find(s => s.type === 'video');
  gates.push(
    await guarded('probe', () => {
      if (!streams) {
        throw new UserError(`ffprobe could not read ${video}`);
      }
      return probeGate(film, video, stream);
    }),
  );
  const fps = (stream && streamFps(stream)) || info.fps;
  gates.push(
    await guarded('motion', async () =>
      gateMotion(info, await decodeMotion(video), fps),
    ),
  );
  if (!streams) {
    const summary = 'video could not be probed';
    gates.push({id: 'audio', status: 'SKIP', summary, details: []});
    return;
  }
  const hasAudio = streams.streams.some(s => s.type === 'audio');
  gates.push(await guarded('audio', () => auditAudio(video, hasAudio)));
}

/** Says why no video was checked and what to do next. */
function missingVideoText(
  video: string,
  given: boolean,
  draftExists: boolean,
): string {
  if (given) {
    return `video not found: ${video}`;
  }
  return draftExists
    ? 'only a draft render exists and a draft is not checked: run render ' +
        'in full, or pass --video out/film-draft.mp4'
    : 'no video: run render first';
}

/** Adds the three video gates, or marks them missing. Returns `incomplete`. */
async function addVideoGates(
  film: OpenFilm,
  options: QaOptions,
  outDir: string,
  gates: GateResult[],
): Promise<string | null> {
  const given = options.video ? resolve(options.video) : null;
  const video = given ?? join(outDir, `film${sizeSuffix(options)}.mp4`);
  if (existsSync(video)) {
    await videoGates(film, video, gates);
    return video;
  }
  const draft = join(outDir, `film${sizeSuffix(options)}-draft.mp4`);
  const why = missingVideoText(video, given !== null, existsSync(draft));
  for (const id of ['probe', 'motion', 'audio'] as const) {
    gates.push({
      id,
      status: given ? 'FAIL' : 'SKIP',
      summary: why,
      details: given && id === 'probe' ? [`FAIL ${why}`] : [],
    });
  }
  return given ? video : null;
}

function summaryOf(film: OpenFilm): FilmSummary {
  const {info, spec} = film;
  return {
    title: info.title,
    width: info.width,
    height: info.height,
    fps: info.fps,
    duration: info.duration,
    frames: info.frames,
    scenes: info.scenes.length,
    loop: info.loop,
    spec: spec.abs,
  };
}

/** Runs the page gates and the video gates on an open film. */
async function gateOpenFilm(
  film: OpenFilm,
  options: QaOptions,
): Promise<QaOutcome> {
  const {info, spec} = film;
  const dir = join(spec.dir, 'out');
  const load = gateLoad(info);
  const gates: GateResult[] = [load];
  applyDrawFailures(load, await findDrawFailures(film.page, info));
  gates.push(await guarded('determinism', () => gateDeterminism(film)));
  gates.push(await guarded('layout', () => gateLayout(film)));
  gates.push(await guarded('holds', () => gateHolds(info)));
  gates.push(await guarded('pacing', () => gatePacing(film)));
  applyPageErrors(load, [...new Set(await pageErrors(film.page))]);
  let video: string | null = null;
  if (!options.pageOnly) {
    video = await addVideoGates(film, options, dir, gates);
  }
  const summary = summaryOf(film);
  const incomplete = !options.pageOnly && video === null;
  const report = buildReport({
    film: summary,
    video,
    gates,
    incomplete,
    pageOnly: options.pageOnly,
  });
  return {report, dir, suffix: reportSuffix(options)};
}

/**
 * Opens the film and runs every gate. A spec that cannot be opened gives a
 * failed load gate instead of an error.
 *
 * @param specPath Path to `film.json`.
 */
export async function qaFilm(
  specPath: string | undefined,
  options: QaOptions,
): Promise<QaOutcome> {
  let film: OpenFilm;
  try {
    film = await openFilm(specPath, {size: options.size, gpu: options.gpu});
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      report: buildReport({
        film: {},
        video: null,
        gates: [loadFailure(message)],
        incomplete: false,
        pageOnly: options.pageOnly,
      }),
      dir: reportDirFor(specPath),
      suffix: reportSuffix(options),
    };
  }
  try {
    return await gateOpenFilm(film, options);
  } finally {
    await film.close();
  }
}

function reportDirFor(specPath: string | undefined): string | null {
  try {
    return join(loadSpec(specPath).dir, 'out');
  } catch {
    return null;
  }
}
