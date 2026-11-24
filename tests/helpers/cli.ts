/**
 * @fileoverview Runs the real command-line entry as a child process, the way
 * a user would, and reports whether Chrome and ffmpeg are available.
 */
import {spawn} from 'node:child_process';
import {findChrome} from '../../plugin/skills/video/scripts/browser/chrome.ts';
import {REEL_ENTRY} from '../../plugin/skills/video/scripts/core/paths.ts';
import {which} from '../../plugin/skills/video/scripts/core/process.ts';

/** What a finished command left behind. */
export interface CliResult {
  /** Exit code, or null when the command was killed. */
  code: number | null;
  /** Standard output and error text, in arrival order. */
  output: string;
}

/** Milliseconds after which a command is killed. */
const COMMAND_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * Runs `node reel.ts <args>` in a folder and waits for it to finish.
 *
 * @param cwd Working folder of the command.
 * @param args Command, spec path and flags.
 */
export function reel(cwd: string, args: string[]): Promise<CliResult> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [REEL_ENTRY, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (d: Buffer) => {
      output += d.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => child.kill('SIGKILL'), COMMAND_TIMEOUT_MS);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({code, output});
    });
  });
}

/**
 * Explains why whole-pipeline tests cannot run here.
 *
 * @returns A sentence for the test runner's skip message, or `false` when
 *   Chrome, ffmpeg and ffprobe are all installed.
 */
export function missingTools(): string | false {
  const missing: string[] = [];
  if (!findChrome()) {
    missing.push('Chrome or Chromium (set REEL_CHROME to its path)');
  }
  for (const tool of ['ffmpeg', 'ffprobe']) {
    if (!which(tool)) {
      missing.push(tool);
    }
  }
  return missing.length
    ? `skipped: whole-pipeline tests need ${missing.join(' and ')}`
    : false;
}
