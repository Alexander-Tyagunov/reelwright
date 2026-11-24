/**
 * @fileoverview Starts a headless browser with the flags that make painting
 * repeatable, and opens pages in it.
 */
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {UserError} from '../core/errors.ts';
import {CdpSession} from './cdp.ts';
import {findChrome} from './chrome.ts';

/** Options for {@link launch}. */
export interface LaunchOptions {
  /** Use the graphics card instead of software drawing. Default false. */
  gpu?: boolean;
}

/** Size of a page's viewport in pixels. */
export interface ViewportSize {
  width: number;
  height: number;
}

/** A running headless browser process. */
export interface Browser {
  /** Path of the browser executable. */
  bin: string;
  /** Opens a blank page with a fixed viewport and scale factor 1. */
  newPage(size: ViewportSize): Promise<CdpSession>;
  /** Closes every page, stops the process and deletes its temp profile. */
  close(): Promise<void>;
}

const START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 3_000;

/** Flags for repeatable output. Each frame is a pure function of time. */
const BASE_FLAGS = [
  '--headless=new',
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--mute-audio',
  '--force-device-scale-factor=1',
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--disable-lcd-text',
  '--run-all-compositor-stages-before-draw',
  '--disable-checker-imaging',
  '--disable-partial-raster',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-image-animation-resync',
  '--disable-skia-runtime-opts',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-extensions',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-sync',
  '--disable-default-apps',
  '--no-pings',
];

function graphicsFlags(gpu: boolean): string[] {
  if (!gpu) {
    return ['--enable-unsafe-swiftshader'];
  }
  const angle: Record<string, string> = {
    darwin: 'metal',
    win32: 'd3d11',
  };
  const backend = angle[process.platform] ?? 'gl';
  return ['--enable-gpu', '--ignore-gpu-blocklist', `--use-angle=${backend}`];
}

function extraFlags(): string[] {
  const root = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
  const custom = process.env.REEL_CHROME_ARGS;
  return [...root, ...(custom ? custom.split(' ') : [])];
}

function waitForPort(proc: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => {
      reject(
        new UserError(`Chrome did not start within 30 s.\n${log.slice(-800)}`),
      );
    }, START_TIMEOUT_MS);
    proc.stderr?.on('data', (d: Buffer) => {
      log += d.toString();
      const m = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    proc.on('exit', code => {
      clearTimeout(timer);
      const why = `Chrome exited (${code}) before it was ready.`;
      reject(new UserError(`${why}\n${log.slice(-800)}`));
    });
  });
}

async function openTarget(port: number): Promise<WebSocket> {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  });
  const target = (await res.json()) as {webSocketDebuggerUrl: string};
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), {once: true});
    ws.addEventListener(
      'error',
      () => reject(new Error('could not connect to Chrome')),
      {once: true},
    );
  });
  return ws;
}

async function openPage(port: number, size: ViewportSize) {
  const session = new CdpSession(await openTarget(port));
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Log.enable');
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: size.width,
    height: size.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return session;
}

function startProcess(options: LaunchOptions) {
  const bin = findChrome();
  if (!bin) {
    throw new UserError(
      'No Chrome, Chromium or Edge found. Install Google Chrome, or set ' +
        'REEL_CHROME to a browser binary.',
    );
  }
  const profile = mkdtempSync(join(tmpdir(), 'reelwright-chrome-'));
  const args = [
    ...BASE_FLAGS,
    `--user-data-dir=${profile}`,
    ...graphicsFlags(options.gpu ?? false),
    ...extraFlags(),
    'about:blank',
  ];
  const proc = spawn(bin, args, {stdio: ['ignore', 'ignore', 'pipe']});
  return {bin, profile, proc};
}

/**
 * Launches headless Chrome, Chromium or Edge.
 *
 * Uses a temporary profile folder named `reelwright-chrome-*`, removed by
 * `close()`. Runs as root with `--no-sandbox`. The variable
 * `REEL_CHROME_ARGS` adds space-separated flags.
 *
 * @throws UserError when no browser is found or it does not start within
 *   30 seconds.
 */
export async function launch(options: LaunchOptions = {}): Promise<Browser> {
  const {bin, profile, proc} = startProcess(options);
  const stopped = new Promise<void>(resolve =>
    proc.once('exit', () => resolve()),
  );
  let port: number;
  try {
    port = await waitForPort(proc);
  } catch (e) {
    proc.kill();
    rmSync(profile, {recursive: true, force: true});
    throw e;
  }
  const sessions: CdpSession[] = [];
  return {
    bin,
    async newPage(size) {
      const session = await openPage(port, size);
      sessions.push(session);
      return session;
    },
    async close() {
      for (const s of sessions) {
        s.close();
      }
      proc.kill();
      const timer = setTimeout(() => proc.kill('SIGKILL'), STOP_TIMEOUT_MS);
      await stopped;
      clearTimeout(timer);
      rmSync(profile, {recursive: true, force: true});
    },
  };
}
