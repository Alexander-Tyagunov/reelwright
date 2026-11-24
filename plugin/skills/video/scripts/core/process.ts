/**
 * @fileoverview Subprocess helpers. Nothing goes through a shell: every
 * command gets an argument array.
 */
import {spawn, spawnSync} from 'node:child_process';
import {onStop} from './cleanup.ts';
import {UserError} from './errors.ts';

/** Result of a finished process. */
export interface RunResult {
  /** Exit code, or `null` when a signal ended the process. */
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Options for {@link run} and {@link capture}. */
export interface RunOptions {
  /** Bytes or text written to standard input. */
  input?: string | Uint8Array;
  /** When true, a non-zero exit code is returned instead of thrown. */
  allowFail?: boolean;
}

interface RawResult {
  code: number | null;
  stdout: Buffer;
  stderr: string;
}

function execute(
  cmd: string,
  args: readonly string[],
  options: RunOptions,
): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {stdio: ['pipe', 'pipe', 'pipe']});
    const forget = onStop(() => void child.kill('SIGKILL'));
    const out: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.stdin.on('error', () => {});
    child.on('error', e => {
      forget();
      reject(new UserError(`could not run ${cmd}: ${e.message}`));
    });
    child.on('close', code => {
      forget();
      const stdout = Buffer.concat(out);
      if (code === 0 || options.allowFail) {
        resolve({code, stdout, stderr});
        return;
      }
      const tail = stderr.slice(-1500);
      reject(new UserError(`${cmd} exited ${code}\n${tail}`));
    });
    child.stdin.end(options.input);
  });
}

/**
 * Runs a process to completion and returns its text output.
 *
 * @throws UserError when the process cannot start, or exits with a
 *   non-zero code and `allowFail` is not set.
 */
export async function run(
  cmd: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const r = await execute(cmd, args, options);
  return {code: r.code, stdout: r.stdout.toString(), stderr: r.stderr};
}

/**
 * Runs a process to completion and returns its standard output as bytes.
 * Use it for binary output such as images.
 *
 * @throws UserError as {@link run} does.
 */
export async function capture(
  cmd: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<Buffer> {
  return (await execute(cmd, args, options)).stdout;
}

/**
 * Finds an executable on the search path.
 *
 * @returns Its absolute path, or `null` when it is not installed.
 */
export function which(name: string): string | null {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(finder, [name], {encoding: 'utf8'});
  if (r.status !== 0) {
    return null;
  }
  return r.stdout.split(/\r?\n/)[0]?.trim() || null;
}

/**
 * Sends a signal to a process and every process in its group, so helper
 * processes do not outlive it. The process must have been started detached
 * on Linux and macOS. On Windows it ends the whole tree.
 *
 * @param pid Process id of the group leader.
 * @param signal Signal name, for example `SIGKILL`.
 */
export function killTree(pid: number | undefined, signal: NodeJS.Signals) {
  if (pid === undefined) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process has already ended.
    }
  }
}
