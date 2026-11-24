/**
 * @fileoverview Closed-form damped spring. The value at time `t` comes from a
 * formula, so it needs no state from earlier frames.
 */

/** Spring settings. */
export interface SpringSpec {
  /**
   * Damping ratio, unitless. 1 means no overshoot (text, UI). 0.8 gives one
   * small bounce (cards, logos). 0.5 gives two bounces (playful). Default 1.
   */
  zeta?: number;
  /** Natural frequency in radians per second. Default 18. */
  omega?: number;
}

const DEFAULT_ZETA = 1;
const DEFAULT_OMEGA = 18;
/** Time constants until the response stays within about 1% of its target. */
const SETTLE_CONSTANTS = 4.6;

/**
 * Unit step response of a damped spring: 0 at the start, 1 at rest.
 * @param t Seconds since the spring started. Zero or less gives 0.
 * @param spec Damping ratio and frequency.
 */
export function spring(t: number, spec: SpringSpec = {}): number {
  const {zeta = DEFAULT_ZETA, omega = DEFAULT_OMEGA} = spec;
  if (t <= 0) {
    return 0;
  }
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega * t);
    const wave = Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t);
    return 1 - decay * wave;
  }
  if (zeta === 1) {
    return 1 - Math.exp(-omega * t) * (1 + omega * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega * (zeta - s);
  const r2 = -omega * (zeta + s);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/**
 * Seconds until a spring stays within about 1% of its target.
 * @param spec Damping ratio and frequency.
 */
export function springSettle(spec: SpringSpec = {}): number {
  const {zeta = DEFAULT_ZETA, omega = DEFAULT_OMEGA} = spec;
  return SETTLE_CONSTANTS / (Math.min(zeta, 1) * omega);
}
