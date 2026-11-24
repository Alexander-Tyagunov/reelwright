/**
 * @fileoverview Seeded random numbers. The same seed always gives the same
 * sequence, so a frame never depends on chance.
 */

/**
 * Creates a seeded generator (mulberry32).
 * @param seed Any integer. Seed 0 is treated as 1.
 * @returns A function that gives the next number in [0, 1) on each call.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
