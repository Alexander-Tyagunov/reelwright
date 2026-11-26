/**
 * @fileoverview Seeded random numbers. The same seed always gives the same
 * sequence, on every machine.
 */

/** A deterministic generator. Create one with {@link createRandom}. */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Next number from 0 (included) up to 1 (excluded). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Next number from `min` (included) up to `max` (excluded). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Next number from -1 up to 1, for noise samples. */
  signed(): number {
    return this.next() * 2 - 1;
  }
}

/**
 * Creates a generator.
 *
 * @param seed Any integer. Only its low 32 bits count.
 */
export function createRandom(seed: number): Random {
  return new Random(seed);
}

/**
 * Mixes a seed with a stream number so that two parts of one track draw
 * from unrelated sequences.
 *
 * @param seed The track seed.
 * @param stream Small whole number that names the part.
 */
export function derivedSeed(seed: number, stream: number): number {
  return Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + stream * 0x27d4eb2f;
}
