/**
 * @fileoverview The determinism gate: a frame must be a pure function of its
 * time. It draws up to six moments cold on a fresh page, and again on a page
 * that drew the two frames before, then compares them pixel by pixel.
 */
import type {OpenFilm} from '../../browser/film.ts';
import {drawAt, frameAt} from '../../browser/film.ts';
import type {FilmInfo} from '../../shared/contract.ts';
import {r3, sceneAt, sceneLabel} from '../labels.ts';
import {diffPngs} from '../pixel-diff.ts';
import type {GateResult} from '../report.ts';
import {
  DETERMINISM_LEVELS,
  DETERMINISM_MAX_TIMES,
  DETERMINISM_PIXELS,
} from '../thresholds.ts';

/**
 * Picks the moments to draw: one per scene at its rest time when there are
 * six or more scenes (spread evenly), otherwise every scene's rest time then
 * the start of later scenes, up to six moments.
 *
 * @returns Film times in seconds, without duplicates.
 */
export function pickTimes(info: FilmInfo): number[] {
  const count = info.scenes.length;
  const cap = (t: number) => r3(Math.min(Math.max(t, 0), info.duration));
  const checks = info.scenes.map(s => cap(s.check));
  const max = DETERMINISM_MAX_TIMES;
  if (count >= max) {
    const picked = Array.from({length: max}, (_, i) => {
      return checks[Math.round((i * (count - 1)) / (max - 1))] ?? 0;
    });
    return [...new Set(picked)];
  }
  const out = [...checks];
  const starts = info.scenes.map(s => cap(s.start + 0.2));
  const order = [...starts.keys()].slice(1).concat(0);
  for (const i of order) {
    const t = starts[i] ?? 0;
    if (out.length < max && !out.includes(t)) {
      out.push(t);
    }
  }
  return out.slice(0, max);
}

const EMPTY = Buffer.alloc(0);

async function drawCold(film: OpenFilm, times: number[]): Promise<Buffer[]> {
  const frames: Buffer[] = [];
  for (const t of times) {
    const page = await film.newPage();
    try {
      frames.push(await frameAt(page, t, {format: 'png'}));
    } finally {
      await page.dispose();
    }
  }
  return frames;
}

async function drawSequential(film: OpenFilm, times: number[]) {
  const {page, info} = film;
  const frames: Buffer[] = [];
  for (const t of times) {
    await drawAt(page, Math.max(0, t - 2 / info.fps));
    await drawAt(page, Math.max(0, t - 1 / info.fps));
    frames.push(await frameAt(page, t, {format: 'png'}));
  }
  return frames;
}

const LEVELS = `more than ${DETERMINISM_LEVELS} levels`;

/** Compares each cold draw with the draw after other frames. */
async function compareCold(
  info: FilmInfo,
  times: number[],
  cold: Buffer[],
  sequential: Buffer[],
): Promise<{bad: string[]; noise: number}> {
  const bad: string[] = [];
  let noise = 0;
  for (const [i, t] of times.entries()) {
    const d = await diffPngs(cold[i] ?? EMPTY, sequential[i] ?? EMPTY);
    noise = Math.max(noise, d.max);
    if (d.pixels > DETERMINISM_PIXELS) {
      bad.push(
        `FAIL t=${t}s ${sceneLabel(info, sceneAt(info, t))}: a cold draw ` +
          `differs from the same frame drawn after the two frames before ` +
          `it: ${d.pixels} px differ by ${LEVELS} (max ${d.max}, limit ` +
          `${DETERMINISM_PIXELS} px). The frame depends on history, a ` +
          'clock or Math.random; make it a pure function of t',
      );
    }
  }
  return {bad, noise};
}

/**
 * Runs the determinism gate. Fails when more than 40 pixels differ by more
 * than 8 levels between a cold draw and a draw after other frames, or when
 * redrawing the first moment last gives a different picture.
 */
export async function gateDeterminism(film: OpenFilm): Promise<GateResult> {
  const {info, page} = film;
  const times = pickTimes(info);
  const cold = await drawCold(film, times);
  const sequential = await drawSequential(film, times);
  const again = await frameAt(page, times[0] ?? 0, {format: 'png'});
  const {bad, noise: coldNoise} = await compareCold(
    info,
    times,
    cold,
    sequential,
  );
  const t0 = times[0] ?? 0;
  const d0 = await diffPngs(again, sequential[0] ?? EMPTY);
  if (d0.pixels > DETERMINISM_PIXELS) {
    bad.push(
      `FAIL t=${t0}s ${sceneLabel(info, sceneAt(info, t0))}: redrawing it ` +
        `after the other times differs from the first draw: ${d0.pixels} px ` +
        `differ by ${LEVELS} (max ${d0.max}). The frame depends on the ` +
        'order frames are drawn in',
    );
  }
  const noise = Math.max(coldNoise, d0.max);
  const verdict = bad.length ? `${bad.length} mismatches` : 'all match';
  return {
    id: 'determinism',
    status: bad.length ? 'FAIL' : 'PASS',
    summary:
      `${times.length} times [${times.join(', ')}] cold vs sequential, plus ` +
      `one order check: ${verdict} (largest pixel difference ${noise} ` +
      `levels; up to ${DETERMINISM_LEVELS} is anti-aliasing noise)`,
    details: bad,
  };
}
