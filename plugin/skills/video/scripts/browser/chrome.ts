/**
 * @fileoverview Finds a Chromium-family browser on macOS, Windows or Linux.
 */
import {existsSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {which} from '../core/process.ts';

const MAC_APPS = [
  'Google Chrome',
  'Chromium',
  'Microsoft Edge',
  'Brave Browser',
  'Google Chrome Canary',
];

const LINUX_NAMES = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'microsoft-edge',
  'brave-browser',
];

function macCandidates(): string[] {
  return MAC_APPS.flatMap(app => [
    `/Applications/${app}.app/Contents/MacOS/${app}`,
    join(homedir(), `Applications/${app}.app/Contents/MacOS/${app}`),
  ]);
}

function windowsCandidates(): string[] {
  const bases = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ].filter((b): b is string => Boolean(b));
  return bases.flatMap(base => [
    join(base, 'Google/Chrome/Application/chrome.exe'),
    join(base, 'Microsoft/Edge/Application/msedge.exe'),
    join(base, 'Chromium/Application/chrome.exe'),
  ]);
}

function linuxCandidates(): string[] {
  const found = LINUX_NAMES.map(name => which(name));
  return found.filter((p): p is string => p !== null);
}

/** Browsers that Playwright or Puppeteer downloaded also work. */
function downloadedCandidates(): string[] {
  const caches = [
    join(homedir(), '.cache/ms-playwright'),
    join(homedir(), 'Library/Caches/ms-playwright'),
    join(homedir(), 'AppData/Local/ms-playwright'),
  ];
  const out: string[] = [];
  for (const cache of caches) {
    if (!existsSync(cache)) {
      continue;
    }
    const dirs = readdirSync(cache).filter(d => d.startsWith('chromium'));
    for (const d of dirs.sort().reverse()) {
      out.push(
        join(cache, d, 'chrome-linux/chrome'),
        join(cache, d, 'chrome-linux64/chrome'),
        join(cache, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
        join(cache, d, 'chrome-win/chrome.exe'),
      );
    }
  }
  return out;
}

/**
 * Finds a Chromium-family browser to drive.
 *
 * The environment variable `REEL_CHROME` wins when set. Otherwise the
 * function checks the usual install places for the current platform, then
 * browsers that Playwright or Puppeteer downloaded.
 *
 * @returns The browser's executable path, or `null` when none is found.
 */
export function findChrome(): string | null {
  const override = process.env.REEL_CHROME;
  if (override) {
    return override;
  }
  let candidates: string[];
  if (process.platform === 'darwin') {
    candidates = macCandidates();
  } else if (process.platform === 'win32') {
    candidates = windowsCandidates();
  } else {
    candidates = linuxCandidates();
  }
  candidates.push(...downloadedCandidates());
  return candidates.find(p => existsSync(p)) ?? null;
}
