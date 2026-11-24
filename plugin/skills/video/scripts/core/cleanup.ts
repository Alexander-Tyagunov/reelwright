/**
 * @fileoverview A registry of things that must be stopped when the program
 * ends: browsers, encoders, servers and temporary files. A stop signal runs
 * every disposer, then exits with 128 plus the signal number. A disposer that
 * was removed earlier, because its owner closed normally, never runs.
 */
import {constants} from 'node:os';

/** Stops one resource. May be async. It must be safe to call once only. */
export type Disposer = () => void | Promise<void>;

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

const disposers = new Set<Disposer>();
let installed = false;
let stopping = false;

/** Takes every disposer out of the registry and runs it once. */
function drain(): Promise<void>[] {
  const todo = [...disposers].reverse();
  disposers.clear();
  return todo.map(async fn => {
    try {
      await fn();
    } catch {
      // A disposer that fails must not stop the others.
    }
  });
}

async function onSignal(name: (typeof SIGNALS)[number]): Promise<void> {
  const code = 128 + (constants.signals[name] ?? 0);
  if (stopping) {
    process.exit(code);
  }
  stopping = true;
  await Promise.all(drain());
  process.exit(code);
}

function install(): void {
  if (installed) {
    return;
  }
  installed = true;
  for (const name of SIGNALS) {
    process.on(name, () => void onSignal(name));
  }
  // Last resort on a normal exit: run what is left without waiting.
  process.on('exit', () => void drain());
}

/**
 * Registers a disposer to run when the process is stopped by SIGINT, SIGTERM
 * or SIGHUP, or exits while the resource is still open.
 *
 * @param dispose Stops the resource. Keep its first step synchronous, so it
 *   still works during a plain exit.
 * @returns A function that removes the disposer. Call it when the resource
 *   closed normally.
 */
export function onStop(dispose: Disposer): () => void {
  install();
  disposers.add(dispose);
  return () => {
    disposers.delete(dispose);
  };
}

/** True once a stop signal arrived and the disposers are running. */
export function isStopping(): boolean {
  return stopping;
}

/** Runs every registered disposer now. Each runs at most once. */
export async function stopAll(): Promise<void> {
  await Promise.all(drain());
}
