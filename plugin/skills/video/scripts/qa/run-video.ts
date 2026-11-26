/**
 * @fileoverview Quality gates for a video made by any tool, with no spec:
 * only the gates that need the file itself (properties, motion, loudness).
 */
import {existsSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import type {StreamFacts} from '../video/probe.ts';
import {probeStreams} from '../video/probe.ts';
import {auditAudio} from './gates/audio.ts';
import {gateMotion} from './gates/motion.ts';
import {gateVideoFile, streamFps} from './gates/probe.ts';
import {guarded} from './guard.ts';
import {r3} from './labels.ts';
import {decodeMotion} from './motion-decode.ts';
import type {QaOptions} from './options.ts';
import type {FilmSummary, GateResult, QaReport} from './report.ts';
import {buildReport} from './report.ts';

/** A finished run and where its report file goes. */
export interface QaOutcome {
  report: QaReport;
  /** Path of the report file, or null to write none. */
  file: string | null;
}

function probeFailure(summary: string): GateResult {
  return {id: 'probe', status: 'FAIL', summary, details: [`FAIL ${summary}`]};
}

function summaryOf(path: string, v: StreamFacts, loop: boolean): FilmSummary {
  const fps = streamFps(v);
  const frames = v.nbFrames ?? v.nbReadPackets ?? 0;
  return {
    title: basename(path),
    width: v.width,
    height: v.height,
    fps: r3(fps),
    duration: r3(frames / fps),
    frames,
    scenes: 1,
    loop,
    spec: null,
  };
}

/** The whole video as one scene, for the motion gate. */
function wholeVideo(film: FilmSummary, options: QaOptions) {
  const seconds = film.duration;
  const scene = {
    index: 0,
    type: 'video',
    id: null,
    start: 0,
    end: seconds,
    duration: seconds,
    check: seconds / 2,
  };
  return {
    scenes: [scene],
    texts: [],
    loop: options.loop,
    maxHold: options.maxHold,
  };
}

/**
 * Checks one video file against the gates that do not need a spec.
 *
 * @param options Uses `video`, `loop` and `maxHold`.
 */
export async function qaVideoFile(options: QaOptions): Promise<QaOutcome> {
  const path = resolve(options.video ?? '');
  const suffix = `-${basename(path).replace(/\.[^.]+$/, '')}`;
  const finish = (gates: GateResult[], film: QaReport['film'] = {}) => ({
    report: buildReport({
      film,
      video: path,
      gates,
      incomplete: false,
      pageOnly: false,
    }),
    // No report file for a video that does not exist.
    file: existsSync(path)
      ? join(dirname(path), `qa-report${suffix}.json`)
      : null,
  });
  if (!existsSync(path)) {
    return finish([probeFailure(`video not found: ${path}`)]);
  }
  const streams = await probeStreams(path, ['-count_packets']);
  const v = streams.streams.find(s => s.type === 'video');
  if (!v) {
    return finish([probeFailure('no video stream')]);
  }
  const film = summaryOf(path, v, options.loop);
  const gates = [gateVideoFile(v, film.frames, film.duration)];
  const input = wholeVideo(film, options);
  gates.push(
    await guarded('motion', async () =>
      gateMotion(input, await decodeMotion(path), streamFps(v)),
    ),
  );
  const audio = streams.streams.find(s => s.type === 'audio');
  const track = {
    soundOn: false,
    hasAudio: audio !== undefined,
    audioSeconds: audio?.duration ?? null,
    videoSeconds: v.duration,
  };
  gates.push(await guarded('audio', () => auditAudio(path, track)));
  return finish(gates, film);
}
