/**
 * @fileoverview Entry point of the film page. `boot` loads a spec, loads the
 * project scene files and mounts the film. Importing this module also defines
 * the global `Reel` that project scene files use, and registers every
 * built-in scene.
 */

import type {FilmSpec} from '../shared/contract.ts';
import {h} from './dom.ts';
import {ease} from './easing.ts';
import {messageOf, recordError} from './errors.ts';
import {formatNumber} from './format.ts';
import {clamp, lerp, prog} from './math.ts';
import {mount} from './mount.ts';
import {seeded} from './random.ts';
import {registerScene} from './registry.ts';
import './scenes/index.ts';
import {spring} from './spring.ts';

window.Reel = {
  scene: registerScene,
  ease,
  spring,
  clamp,
  lerp,
  prog,
  h,
  formatNumber,
  seeded,
};

addEventListener('error', e => recordError(e.message));
addEventListener('unhandledrejection', e => recordError(messageOf(e.reason)));

async function loadCustomScene(src: string): Promise<void> {
  const url = new URL(src, location.href).href;
  try {
    await import(url);
  } catch {
    throw new Error(`could not load custom scene script: ${src}`);
  }
}

function showFailure(err: unknown): void {
  const box = document.getElementById('rw-error');
  if (box) {
    box.style.display = 'block';
    const detail = err instanceof Error ? (err.stack ?? err.message) : err;
    box.textContent = `Reelwright: ${detail}`;
  }
}

/**
 * Loads and mounts a film. Errors go to `window.__errors` and set
 * `window.__ready` to `'error'`; the function itself never rejects.
 * @param spec A URL that serves the spec as JSON, or the spec itself.
 */
export async function boot(spec: string | FilmSpec): Promise<void> {
  try {
    const film: FilmSpec =
      typeof spec === 'string' ? await (await fetch(spec)).json() : spec;
    for (const src of film.customScenes ?? []) {
      await loadCustomScene(src);
    }
    await mount(film);
  } catch (err) {
    recordError(messageOf(err));
    showFailure(err);
    window.__ready = 'error';
  }
}
