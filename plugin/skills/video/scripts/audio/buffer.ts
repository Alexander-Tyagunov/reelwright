/**
 * @fileoverview Stereo sample buffers and mixing. Samples are 32-bit floats
 * from -1 to 1, where 1 is full scale (0 dBFS). Positions are in seconds
 * and lengths in samples at {@link SAMPLE_RATE}.
 */

/** Samples per second of every buffer the synthesiser makes. */
export const SAMPLE_RATE = 48000;

/** Two channels of samples. Both arrays have the same length. */
export interface StereoBuffer {
  left: Float32Array;
  right: Float32Array;
}

/** Creates a silent buffer. `samples` is a whole number of samples. */
export function createBuffer(samples: number): StereoBuffer {
  return {left: new Float32Array(samples), right: new Float32Array(samples)};
}

/** Number of samples in `seconds`, rounded to the nearest sample. */
export function samplesOf(seconds: number): number {
  return Math.round(seconds * SAMPLE_RATE);
}

/** Decibels relative to full scale as a linear factor: -6 gives 0.5. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** Linear factor as decibels: 0.5 gives -6. Zero gives `-Infinity`. */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain);
}

/**
 * Equal-power channel gains for a pan position.
 *
 * @param pan -1 for hard left, 0 for centre, 1 for hard right.
 * @returns Linear gains `[left, right]`; the centre gives 0.707 each.
 */
export function panGains(pan: number): [number, number] {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

/**
 * Adds a mono signal into a buffer. Samples outside the buffer are dropped.
 *
 * @param dst Buffer that receives the sum.
 * @param mono Signal to add.
 * @param startSample Index in `dst` where `mono[0]` lands. May be negative.
 * @param gain Linear factor applied to the signal.
 * @param pan -1 left, 0 centre, 1 right.
 */
export function addMono(
  dst: StereoBuffer,
  mono: Float32Array,
  startSample: number,
  gain: number,
  pan: number,
): void {
  const [gl, gr] = panGains(pan);
  const from = Math.max(0, -startSample);
  const to = Math.min(mono.length, dst.left.length - startSample);
  for (let i = from; i < to; i++) {
    const v = (mono[i] ?? 0) * gain;
    const at = startSample + i;
    dst.left[at] = (dst.left[at] ?? 0) + v * gl;
    dst.right[at] = (dst.right[at] ?? 0) + v * gr;
  }
}

/**
 * Adds one buffer into another at an offset. Samples outside `dst` are
 * dropped.
 *
 * @param startSample Index in `dst` where `src` sample 0 lands.
 * @param gain Linear factor applied to `src`.
 */
export function addBuffer(
  dst: StereoBuffer,
  src: StereoBuffer,
  startSample: number,
  gain: number,
): void {
  const from = Math.max(0, -startSample);
  const to = Math.min(src.left.length, dst.left.length - startSample);
  for (let i = from; i < to; i++) {
    const at = startSample + i;
    dst.left[at] = (dst.left[at] ?? 0) + (src.left[i] ?? 0) * gain;
    dst.right[at] = (dst.right[at] ?? 0) + (src.right[i] ?? 0) * gain;
  }
}

/** Largest absolute sample value over both channels, as a linear level. */
export function peakOf(buf: StereoBuffer): number {
  let peak = 0;
  for (const ch of [buf.left, buf.right]) {
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i] ?? 0);
      if (v > peak) {
        peak = v;
      }
    }
  }
  return peak;
}
