/**
 * @fileoverview The probe gate: the MP4's codec, pixel format, size, frame
 * rate and frame count against what the film should have produced, and
 * whether the video is still current. Sizes are in pixels, rates in frames
 * per second.
 */
import {existsSync, readFileSync} from 'node:fs';
import type {StreamFacts} from '../../video/probe.ts';
import {parseFraction} from '../../video/probe.ts';
import {r3} from '../labels.ts';
import type {Findings, GateResult} from '../report.ts';
import {findings} from '../report.ts';

/** What a video of the film must look like. */
export interface Expectation {
  width: number;
  height: number;
  fps: number;
  frames: number;
}

/** The fields of `render*.json` that this gate reads. */
export interface RenderSummary extends Partial<Expectation> {
  /** Fingerprint of the spec, runtime and project files at render time. */
  specHash?: string;
}

/** Inputs of {@link gateProbe}. */
export interface ProbeInput {
  /** Path of the video. A name ending in `-draft.mp4` is a draft. */
  video: string;
  /** Values for the film at the size being checked. */
  expected: Expectation;
  /** The render summary next to the video, or null. */
  summary: RenderSummary | null;
  /** Fingerprint of the film now, or null when it was not computed. */
  currentHash: string | null;
  /** File name of the summary, for the draft note. */
  summaryName?: string;
}

/**
 * Reads a render summary file.
 *
 * @param path Path of the summary, or null for a video not named after the
 *   spec.
 * @returns The summary, or null when it is absent or unreadable.
 */
export function readRenderSummary(path: string | null): RenderSummary | null {
  if (!path || !existsSync(path)) {
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >;
    const num = (k: string) =>
      typeof raw[k] === 'number' ? raw[k] : undefined;
    return {
      specHash: typeof raw.specHash === 'string' ? raw.specHash : undefined,
      width: num('width'),
      height: num('height'),
      fps: num('fps'),
      frames: num('frames'),
    };
  } catch {
    return null;
  }
}

/** Frames per second of a stream; falls back when the average is `0/0`. */
export function streamFps(v: StreamFacts): number {
  return parseFraction(v.avgFrameRate) || parseFraction(v.rFrameRate);
}

function expectedFromSummary(s: RenderSummary | null): Expectation | null {
  if (!s) {
    return null;
  }
  const {width, height, fps, frames} = s;
  const all = [width, height, fps, frames];
  return all.every(v => v !== undefined)
    ? ({width, height, fps, frames} as Expectation)
    : null;
}

/** What a video stream actually contains. */
interface Found {
  codec: string;
  pix: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
}

function factsOf(stream: StreamFacts): Found {
  return {
    codec: stream.codec,
    pix: stream.pixFmt,
    width: stream.width,
    height: stream.height,
    fps: streamFps(stream),
    frames: stream.nbFrames ?? stream.nbReadPackets ?? Number.NaN,
  };
}

/** What to compare with, and a note for the summary line. */
function expectationFor(input: ProbeInput): {
  want: Expectation | null;
  note: string;
} {
  if (!/-draft\.mp4$/i.test(input.video)) {
    return {want: input.expected, note: ''};
  }
  const want = expectedFromSummary(input.summary);
  const name = input.summaryName ?? 'the render summary';
  const note = want
    ? ` (draft: expected values from ${name})`
    : ' (draft without a summary json: size, fps and frame count not compared)';
  return {want, note};
}

/**
 * Compares a video stream with the expectation.
 *
 * A draft video is compared with its own render summary, because a draft has
 * a different size and rate. A summary made from another spec, runtime or
 * project file set means the video is older than the film.
 *
 * @param stream The first video stream, or undefined when there is none.
 */
export function gateProbe(
  input: ProbeInput,
  stream: StreamFacts | undefined,
): GateResult {
  if (!stream) {
    return {
      id: 'probe',
      status: 'FAIL',
      summary: 'no video stream',
      details: ['FAIL the file has no video stream'],
    };
  }
  const result = findings();
  const {summary, currentHash} = input;
  if (summary?.specHash && currentHash && summary.specHash !== currentHash) {
    result.add(
      'FAIL',
      'the video is older than the spec or runtime: render again',
    );
  }
  const found = factsOf(stream);
  const {want, note} = expectationFor(input);
  const bad = (what: string, exp: unknown, got: unknown) =>
    result.add('FAIL', `${what}: expected ${exp}, found ${got}`);
  if (found.codec !== 'h264') {
    bad('codec', 'h264', found.codec);
  }
  if (found.pix !== 'yuv420p') {
    bad('pix_fmt', 'yuv420p', found.pix);
  }
  if (want) {
    compareFacts(want, found, bad);
    addHint(result, input.expected);
  }
  return {
    id: 'probe',
    status: result.status,
    summary:
      `${found.codec} ${found.pix} ${found.width}x${found.height} ` +
      `${r3(found.fps)} fps ${found.frames} frames${note}`,
    details: result.details,
  };
}

function addHint(result: Findings, film: Expectation): void {
  const other = result.details.some(d => !/older than the spec/.test(d));
  if (result.status === 'FAIL' && other) {
    result.details.push(
      'hint: render the film again at the size you are checking ' +
        `(${film.width}x${film.height}), or pass --size / --video that match`,
    );
  }
}

function compareFacts(
  want: Expectation,
  got: {width: number; height: number; fps: number; frames: number},
  bad: (what: string, want: unknown, got: unknown) => void,
): void {
  if (got.width !== want.width || got.height !== want.height) {
    bad('size', `${want.width}x${want.height}`, `${got.width}x${got.height}`);
  }
  if (Math.abs(got.fps - want.fps) > 0.01) {
    bad('fps', want.fps, r3(got.fps));
  }
  if (got.frames !== want.frames) {
    bad('frame count', want.frames, got.frames);
  }
}

/**
 * Probe gate for a video checked without a spec: only the delivery format
 * is judged. H.264 in yuv420p passes; anything else warns.
 *
 * @param seconds Length of the video in seconds.
 */
export function gateVideoFile(
  stream: StreamFacts,
  frames: number,
  seconds: number,
): GateResult {
  const fps = streamFps(stream);
  const web = stream.codec === 'h264' && stream.pixFmt === 'yuv420p';
  const text = `${stream.codec} ${stream.pixFmt}`;
  return {
    id: 'probe',
    status: web ? 'PASS' : 'WARN',
    summary:
      `${text} ${stream.width}x${stream.height} ${r3(fps)} fps ` +
      `${frames} frames, ${r3(seconds)} s`,
    details: web
      ? []
      : [
          `WARN ${text} may not play everywhere; H.264 yuv420p is the safe ` +
            'delivery format',
        ],
  };
}
