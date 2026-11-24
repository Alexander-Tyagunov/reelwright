/**
 * @fileoverview `doctor`: checks that everything Reelwright needs is
 * installed, and says how to install what is missing.
 */

import {existsSync, readdirSync} from 'node:fs';
import * as nodeModule from 'node:module';
import {join} from 'node:path';
import {findChrome} from '../browser/chrome.ts';
import {launch} from '../browser/launch.ts';
import type {Args} from '../core/args.ts';
import {RUNTIME_DIR} from '../core/paths.ts';
import {run as exec, which} from '../core/process.ts';

/** Install commands for one missing item, by platform. */
interface Fix {
  mac: string;
  win: string;
  deb: string;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fix: Fix;
}

const REINSTALL = 'reinstall or update the Reelwright plugin';
const FIX_NODE: Fix = {
  mac: 'brew install node',
  win: 'winget install OpenJS.NodeJS',
  deb: 'sudo apt install -y nodejs   (needs Node 24+; see nodejs.org)',
};
const FIX_FFMPEG: Fix = {
  mac: 'brew install ffmpeg',
  win: 'winget install Gyan.FFmpeg',
  deb: 'sudo apt install -y ffmpeg',
};
const FIX_CHROME: Fix = {
  mac: 'brew install --cask google-chrome',
  win: 'winget install Google.Chrome',
  deb: 'sudo apt install -y chromium   (or google-chrome-stable)',
};
const FIX_FONTS: Fix = {mac: REINSTALL, win: REINSTALL, deb: REINSTALL};

const REQUIRED_FONTS = [
  'inter-latin-wght-normal.woff2',
  'jetbrains-mono-latin-wght-normal.woff2',
];

function checkNode(): Check {
  const version = process.versions.node;
  const ok = Number(version.split('.')[0]) >= 24;
  const detail = `v${version}${ok ? '' : ' (need 24 or newer)'}`;
  return {name: 'node', ok, detail, fix: FIX_NODE};
}

function checkStrip(): Check {
  const ok = typeof nodeModule.stripTypeScriptTypes === 'function';
  const detail = ok ? 'available' : 'missing in this Node version';
  return {name: 'type stripping', ok, detail, fix: FIX_NODE};
}

async function versionOf(bin: string): Promise<string | null> {
  if (!which(bin)) {
    return null;
  }
  const r = await exec(bin, ['-version'], {allowFail: true});
  return r.stdout.match(/version\s+(\S+)/)?.[1] ?? 'unknown version';
}

async function checkFfmpeg(): Promise<Check[]> {
  const checks: Check[] = [];
  const ffmpeg = await versionOf('ffmpeg');
  const ffprobe = await versionOf('ffprobe');
  const detail = (v: string | null): string =>
    v ? `version ${v}` : 'not found on PATH';
  checks.push({
    name: 'ffmpeg',
    ok: ffmpeg !== null,
    detail: detail(ffmpeg),
    fix: FIX_FFMPEG,
  });
  checks.push({
    name: 'ffprobe',
    ok: ffprobe !== null,
    detail: detail(ffprobe),
    fix: FIX_FFMPEG,
  });
  if (ffmpeg) {
    const out = (
      await exec('ffmpeg', ['-hide_banner', '-encoders'], {allowFail: true})
    ).stdout;
    for (const name of ['libx264', 'aac']) {
      const ok = new RegExp(`^\\s*[VASFXBD.]{6}\\s+${name}\\s`, 'm').test(out);
      const text = ok ? 'encoder present' : 'encoder missing';
      checks.push({
        name: `ffmpeg ${name}`,
        ok,
        detail: text,
        fix: FIX_FFMPEG,
      });
    }
  }
  return checks;
}

async function checkBrowser(): Promise<Check> {
  const bin = findChrome();
  if (!bin) {
    return {
      name: 'browser',
      ok: false,
      detail: 'no Chrome, Chromium or Edge found (set REEL_CHROME to a binary)',
      fix: FIX_CHROME,
    };
  }
  let browser: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    const v = await exec(bin, ['--version'], {allowFail: true});
    const version = v.stdout.trim().replace(/\s+/g, ' ');
    browser = await launch();
    const page = await browser.newPage({width: 320, height: 240});
    await page.send('Page.navigate', {
      url: 'data:text/html,<title>ok</title><p>hi</p>',
    });
    await new Promise(resolve => setTimeout(resolve, 200));
    const ok = (await page.eval('1+1')) === 2;
    const state = ok ? 'works' : 'FAILED';
    const detail =
      `${version || 'version unknown'} (${bin}); ` +
      `headless launch + page load ${state}`;
    return {name: 'browser', ok, detail, fix: FIX_CHROME};
  } catch (e) {
    const why = (e instanceof Error ? e.message : String(e)).split('\n')[0];
    const detail = `${bin}; found but could not run headless: ${why}`;
    return {name: 'browser', ok: false, detail, fix: FIX_CHROME};
  } finally {
    await browser?.close().catch(() => {});
  }
}

function checkFonts(): Check {
  const dir = join(RUNTIME_DIR, 'fonts');
  const files = existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.woff2'))
    : [];
  const missing = REQUIRED_FONTS.filter(f => !files.includes(f));
  const ok = files.length > 0 && missing.length === 0;
  const detail = ok
    ? `${files.length} woff2 files in runtime/fonts`
    : `missing ${missing.join(', ') || 'all'} in ${dir}`;
  return {name: 'bundled fonts', ok, detail, fix: FIX_FONTS};
}

function report(checks: Check[]): number {
  const width = Math.max(...checks.map(c => c.name.length));
  for (const c of checks) {
    const mark = c.ok ? 'OK     ' : 'MISSING';
    console.log(`${mark}  ${c.name.padEnd(width)}  ${c.detail}`);
  }
  const bad = checks.filter(c => !c.ok);
  for (const c of bad) {
    console.log(`\nTo fix "${c.name}":`);
    console.log(`  macOS (brew):          ${c.fix.mac}`);
    console.log(`  Windows (winget):      ${c.fix.win}`);
    console.log(`  Debian/Ubuntu (apt):   ${c.fix.deb}`);
  }
  if (bad.length === 0) {
    console.log('\nVerdict: all good, Reelwright is ready to render.');
    return 0;
  }
  const plural = bad.length > 1 ? 's' : '';
  const names = bad.map(c => c.name).join(', ');
  console.log(`\nVerdict: ${bad.length} problem${plural} to fix (${names}).`);
  return 1;
}

/**
 * Runs every environment check and prints one line per check.
 *
 * @param _args Unused. The command takes no options.
 * @returns 0 when all checks pass, 1 otherwise.
 */
export async function run(_args: Args): Promise<number> {
  const checks = [checkNode(), checkStrip(), ...(await checkFfmpeg())];
  checks.push(await checkBrowser(), checkFonts());
  return report(checks);
}
