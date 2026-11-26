/**
 * @fileoverview Opens a film in headless Chrome and draws frames from it.
 */

import {UserError} from '../core/errors.ts';
import type {LoadedSpec} from '../core/spec.ts';
import {frameSize, loadSpec} from '../core/spec.ts';
import {serve} from '../server/server.ts';
import type {FilmInfo} from '../shared/contract.ts';
import type {CdpSession, ShotOptions} from './cdp.ts';
import type {Browser, ViewportSize} from './launch.ts';
import {launch} from './launch.ts';

/** A browser page that shows a film. */
export type FilmPage = CdpSession & {
  /** Closes the page's browser process. Call it once the page is not used. */
  dispose(): Promise<void>;
};

/** Options for {@link openFilm}. */
export interface OpenFilmOptions {
  /** Frame size override such as `1080x1920`. */
  size?: string;
  /** Draw with the graphics card. Default false. */
  gpu?: boolean;
}

/** A film that is loaded and ready to draw frames. */
export interface OpenFilm {
  /** The film's timing and size, as the page reports it. */
  info: FilmInfo;
  /** The first page. */
  page: FilmPage;
  /** Opens one more ready page, in its own browser process. */
  newPage(): Promise<FilmPage>;
  /** Closes every page's browser and the server. */
  close(): Promise<void>;
  /** Address of the film page on the local server. */
  url: string;
  spec: LoadedSpec;
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
}

const READY_TIMEOUT_MS = 30_000;

/**
 * Waits until the page sets `window.__ready`.
 *
 * @param timeoutMs Longest wait in milliseconds.
 * @returns `true` when ready, `'error'` when loading failed, or `'timeout'`.
 */
export async function waitUntilReady(
  page: CdpSession,
  timeoutMs = READY_TIMEOUT_MS,
): Promise<unknown> {
  return page.eval(`new Promise(done => {
    const t0 = Date.now();
    const check = () => {
      if (window.__ready) done(window.__ready);
      else if (Date.now() - t0 > ${timeoutMs}) done('timeout');
      else setTimeout(check, 25);
    };
    check();
  })`);
}

/**
 * Collects every error the page reported: those the runtime stored in
 * `window.__errors` and those the browser raised.
 */
export async function pageErrors(page: CdpSession): Promise<string[]> {
  const stored = (await page.eval('window.__errors || []')) as string[];
  return [...stored, ...page.errors];
}

const FRAME_FAILURE = /scene \d+ \([^)]*\) threw at t=[\d.]+s: [^\n]*/;
const FRAME_FILE = /plate frame [^\n]*/;

/**
 * Makes the page's `eval` report a scene that threw while a frame was drawn
 * as a `UserError` that holds the scene's message and no stack.
 */
function explainFrameFailures(page: CdpSession): void {
  const rawEval = page.eval.bind(page);
  page.eval = async expression => {
    try {
      return await rawEval(expression);
    } catch (e) {
      const text = e instanceof Error ? e.message : '';
      const file = FRAME_FILE.exec(text);
      if (file) {
        throw new UserError(file[0]);
      }
      const found = FRAME_FAILURE.exec(text);
      if (!found) {
        throw e;
      }
      throw new UserError(
        `${found[0]}. Fix that scene's code, or remove the scene, ` +
          'then run the command again.',
      );
    }
  };
}

/** Opens one ready page in a new browser process. */
async function openReadyPage(
  url: string,
  size: ViewportSize,
  gpu: boolean,
  browsers: Browser[],
): Promise<FilmPage> {
  const browser = await launch({gpu});
  browsers.push(browser);
  const session = await browser.newPage(size);
  const dispose = async (): Promise<void> => {
    const i = browsers.indexOf(browser);
    if (i >= 0) {
      browsers.splice(i, 1);
    }
    await browser.close();
  };
  const page = Object.assign(session, {dispose});
  explainFrameFailures(page);
  await page.send('Page.navigate', {url});
  const ready = await waitUntilReady(page);
  if (ready !== true) {
    const detail =
      (await pageErrors(page)).join('\n') ||
      'No error was reported; check that the spec and custom scenes load.';
    throw new UserError(
      `the film page did not become ready (${ready}).\n${detail}`,
    );
  }
  return page;
}

/**
 * Loads a film and waits until it can draw frames.
 *
 * Each page runs in its own browser process, because a background tab of
 * one browser is not painted and its screenshots stall.
 *
 * @param specPath Path to `film.json`.
 * @throws UserError when the spec is invalid, no browser is found, or the
 *   page does not become ready within 30 seconds.
 */
export async function openFilm(
  specPath: string | undefined,
  options: OpenFilmOptions = {},
): Promise<OpenFilm> {
  const spec = loadSpec(specPath);
  const size = frameSize(spec.film, options.size);
  const server = await serve({specPath: spec.abs, projectDir: spec.dir});
  const url = `${server.url}?render=1&size=${size.width}x${size.height}`;
  const browsers: Browser[] = [];
  const close = async (): Promise<void> => {
    await Promise.all(browsers.map(b => b.close()));
    await server.close();
  };
  const newPage = () =>
    openReadyPage(url, size, options.gpu ?? false, browsers);
  try {
    const page = await newPage();
    const info = (await page.eval('window.__film')) as FilmInfo;
    return {info, page, newPage, close, url, spec, ...size};
  } catch (e) {
    await close();
    throw e;
  }
}

/**
 * Draws the film at one time and waits until every picture that frame needs
 * is decoded, such as a plate frame. Every capture path draws through this,
 * because a frame drawn before its pictures are ready captures blank.
 *
 * @param t Time in seconds from the start of the film.
 * @throws UserError that names the file when a plate frame is missing.
 */
export async function drawAt(page: CdpSession, t: number): Promise<void> {
  await page.eval(
    `(async () => { window.renderAt(${t}); await window.__settle?.(); })()`,
  );
}

/**
 * Draws the film at one time and returns a screenshot.
 *
 * @param t Time in seconds from the start of the film.
 * @returns Encoded image bytes: JPEG unless `options.format` is `png`.
 */
export async function frameAt(
  page: CdpSession,
  t: number,
  options?: ShotOptions,
): Promise<Buffer> {
  await drawAt(page, t);
  return page.shot(options);
}
