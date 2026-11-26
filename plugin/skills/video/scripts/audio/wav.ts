/**
 * @fileoverview WAV file writer: 16-bit PCM, two channels, 48 kHz. The bytes
 * depend only on the samples, so equal buffers give equal files.
 */
import type {StereoBuffer} from './buffer.ts';
import {SAMPLE_RATE} from './buffer.ts';

const HEADER_BYTES = 44;
const BYTES_PER_FRAME = 4;

function toInt16(x: number): number {
  const v = Math.round(x * 32767);
  return Math.min(32767, Math.max(-32768, v));
}

/**
 * Encodes a buffer as a WAV file.
 *
 * @param buf Samples from -1 to 1. Values outside are clipped.
 * @returns The whole file: a 44-byte header and 4 bytes per sample frame.
 */
export function encodeWav(buf: StereoBuffer): Uint8Array {
  const frames = buf.left.length;
  const dataBytes = frames * BYTES_PER_FRAME;
  const bytes = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, text: string): void => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(at + i, text.charCodeAt(i));
    }
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  tag(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * BYTES_PER_FRAME, true);
  view.setUint16(32, BYTES_PER_FRAME, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < frames; i++) {
    view.setInt16(HEADER_BYTES + i * 4, toInt16(buf.left[i] ?? 0), true);
    view.setInt16(HEADER_BYTES + i * 4 + 2, toInt16(buf.right[i] ?? 0), true);
  }
  return bytes;
}
