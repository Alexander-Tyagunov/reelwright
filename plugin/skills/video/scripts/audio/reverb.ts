/**
 * @fileoverview Echo effects: a feedback delay and a small room reverb. Both
 * work on a stereo buffer in place and keep its length, so a tail that
 * runs past the end is cut off.
 */
import type {StereoBuffer} from './buffer.ts';
import {SAMPLE_RATE} from './buffer.ts';
import {highpass} from './filter.ts';

/** Comb delays in samples at 48 kHz for the left channel. */
const COMBS = [1557, 1617, 1491, 1422, 1277, 1356];

/** Extra samples that make the right channel different from the left. */
const RIGHT_SPREAD = 23;

/** All-pass delays in samples at 48 kHz. */
const ALLPASS = [225, 556];

/** Feedback of each all-pass stage. */
const ALLPASS_FEEDBACK = 0.5;

/** Damping of the high end inside the combs, from 0 to 1. */
const DAMPING = 0.35;

/** Cutoff in hertz under which nothing goes into the reverb. */
const SEND_HIGHPASS_HZ = 300;

/** Share of the left-right difference of the tail that is kept, 0 to 1. */
const TAIL_WIDTH = 0.5;

/** Fraction of the input that goes into the reverb. */
const SEND = 0.25;

function comb(
  input: Float32Array,
  out: Float32Array,
  delay: number,
  seconds: number,
): void {
  const line = new Float32Array(delay);
  const feedback = 10 ** ((-3 * delay) / (seconds * SAMPLE_RATE));
  let pos = 0;
  let lp = 0;
  for (let i = 0; i < input.length; i++) {
    const y = line[pos] ?? 0;
    lp = y * (1 - DAMPING) + lp * DAMPING;
    line[pos] = (input[i] ?? 0) * SEND + lp * feedback;
    out[i] = (out[i] ?? 0) + y;
    pos = pos + 1 === delay ? 0 : pos + 1;
  }
}

function allpass(data: Float32Array, delay: number): void {
  const line = new Float32Array(delay);
  let pos = 0;
  for (let i = 0; i < data.length; i++) {
    const buffered = line[pos] ?? 0;
    const x = data[i] ?? 0;
    line[pos] = x + buffered * ALLPASS_FEEDBACK;
    data[i] = buffered - x * ALLPASS_FEEDBACK;
    pos = pos + 1 === delay ? 0 : pos + 1;
  }
}

function reverbChannel(
  input: Float32Array,
  spread: number,
  seconds: number,
): Float32Array {
  const wet = new Float32Array(input.length);
  for (const delay of COMBS) {
    comb(input, wet, delay + spread, seconds);
  }
  for (const delay of ALLPASS) {
    allpass(wet, delay + spread);
  }
  return wet;
}

/**
 * Adds a room reverb to a buffer.
 *
 * @param buf Buffer, changed in place.
 * @param wet Level of the reverb relative to the dry signal, 0 to 1.
 * @param seconds Time the tail takes to fall by 60 dB, in seconds.
 */
export function addReverb(
  buf: StereoBuffer,
  wet: number,
  seconds: number,
): void {
  if (wet <= 0) {
    return;
  }
  const sendL = buf.left.slice();
  const sendR = buf.right.slice();
  highpass(sendL, SEND_HIGHPASS_HZ, SAMPLE_RATE);
  highpass(sendR, SEND_HIGHPASS_HZ, SAMPLE_RATE);
  const left = reverbChannel(sendL, 0, seconds);
  const right = reverbChannel(sendR, RIGHT_SPREAD, seconds);
  for (let i = 0; i < buf.left.length; i++) {
    const mid = ((left[i] ?? 0) + (right[i] ?? 0)) / 2;
    const side = ((left[i] ?? 0) - (right[i] ?? 0)) / 2;
    buf.left[i] = (buf.left[i] ?? 0) + (mid + side * TAIL_WIDTH) * wet;
    buf.right[i] = (buf.right[i] ?? 0) + (mid - side * TAIL_WIDTH) * wet;
  }
}

/**
 * Adds a ping-pong echo: each repeat swaps sides and is quieter.
 *
 * @param buf Buffer, changed in place.
 * @param seconds Time between repeats, in seconds.
 * @param feedback Level of each repeat relative to the one before, 0 to 0.9.
 * @param mix Level of the first repeat relative to the dry signal.
 */
export function addDelay(
  buf: StereoBuffer,
  seconds: number,
  feedback: number,
  mix: number,
): void {
  const d = Math.max(1, Math.round(seconds * SAMPLE_RATE));
  const n = buf.left.length;
  const dryL = buf.left.slice();
  const dryR = buf.right.slice();
  for (let i = d; i < n; i++) {
    const fromR = (buf.right[i - d] ?? 0) - (dryR[i - d] ?? 0);
    const fromL = (buf.left[i - d] ?? 0) - (dryL[i - d] ?? 0);
    buf.left[i] =
      (buf.left[i] ?? 0) + (dryL[i - d] ?? 0) * mix + fromR * feedback;
    buf.right[i] =
      (buf.right[i] ?? 0) + (dryR[i - d] ?? 0) * mix + fromL * feedback;
  }
}
