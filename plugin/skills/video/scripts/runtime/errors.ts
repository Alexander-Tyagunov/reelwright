/**
 * @fileoverview Collects errors on `window.__errors` for the Node side.
 */

/**
 * Adds a message to `window.__errors`. The list is created on first use.
 * @param message Text that says what went wrong.
 */
export function recordError(message: string): void {
  const list = window.__errors ?? [];
  list.push(message);
  window.__errors = list;
}

/**
 * Gets the message of any thrown value.
 * @param err A caught value.
 */
export function messageOf(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
