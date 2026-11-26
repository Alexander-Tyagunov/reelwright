/**
 * @fileoverview The page-level wait before a capture. A scene that loads
 * pictures registers a settler; `settleAll` resolves once every picture that
 * the current frame needs is ready. It is published as `window.__settle`.
 */

/** Returns a promise while something is loading, or `null` when ready. */
export type Settler = () => Promise<void> | null;

const settlers: Settler[] = [];

/**
 * Registers a function that reports what the current frame still waits for.
 * @param settler Called on every `settleAll`. Must not change the frame.
 */
export function registerSettler(settler: Settler): void {
  settlers.push(settler);
}

/**
 * Waits until every registered settler is ready. Resolves in the same turn
 * when nothing is pending, so a film without pictures to load loses no time.
 * @returns A promise that rejects with the first loading failure.
 */
export function settleAll(): Promise<void> {
  const pending = settlers.map(s => s()).filter(p => p !== null);
  return pending.length
    ? Promise.all(pending).then(() => undefined)
    : Promise.resolve();
}
