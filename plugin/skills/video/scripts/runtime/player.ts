/**
 * @fileoverview The live scrubbing player: play and pause, a frame slider and
 * keyboard control. It is for people looking at the page; the renderer never
 * uses it. This is the only file that reads a clock, because it plays in real
 * time. Every frame it draws still comes from `renderAt(t)`.
 */

import type {FilmInfo} from '../shared/contract.ts';
import {h} from './dom.ts';
import {clamp} from './math.ts';

/** Height in pixels of the control bar under the stage. */
const BAR_HEIGHT = 56;

/** What the player needs from the mounted film. */
export interface PlayerSource {
  stage: HTMLElement;
  viewport: HTMLElement;
  film: FilmInfo;
  /** Draws film time `t`, in seconds. It throws when a scene fails. */
  renderAt: (t: number) => void;
  /** Gives the time of the last drawn frame, in seconds. */
  getTime: () => number;
}

function fitStage(source: PlayerSource): void {
  const {stage, viewport, film} = source;
  const scale = Math.min(
    innerWidth / film.width,
    (innerHeight - BAR_HEIGHT) / film.height,
  );
  stage.style.transform = `scale(${scale})`;
  viewport.style.paddingBottom = `${BAR_HEIGHT}px`;
  viewport.style.width = '100%';
  viewport.style.height = '100%';
  stage.style.position = 'absolute';
  stage.style.left = `${(innerWidth - film.width) / 2}px`;
  stage.style.top = `${(innerHeight - BAR_HEIGHT - film.height) / 2}px`;
}

/** Playback state and the actions that change it. */
interface Transport {
  setPlaying(on: boolean): void;
  seek(t: number): void;
  toggle(): void;
}

/** Builds the function that draws one time and updates the controls. */
function createShow(
  source: PlayerSource,
  range: HTMLInputElement,
  label: HTMLElement,
): (t: number) => void {
  const {film, renderAt} = source;
  const {fps, duration} = film;
  return t => {
    try {
      renderAt(t);
    } catch {
      // The failing scene is already recorded; keep the player running.
    }
    range.value = String(Math.round(t * fps));
    const scene = film.scenes.findLast(s => t >= s.start) ?? film.scenes[0];
    label.textContent =
      `${t.toFixed(2)}s / ${duration.toFixed(2)}s  f${Math.round(t * fps)}` +
      `  scene ${(scene?.index ?? 0) + 1} ${scene?.type ?? ''}`;
  };
}

function createTransport(
  source: PlayerSource,
  button: HTMLElement,
  range: HTMLInputElement,
  label: HTMLElement,
): Transport & {tick: (now: number) => void} {
  const {getTime} = source;
  const {fps, duration} = source.film;
  const show = createShow(source, range, label);
  let playing = true;
  let t0 = performance.now();
  let base = 0;
  const setPlaying = (on: boolean) => {
    playing = on;
    button.textContent = on ? 'pause' : 'play';
    if (on) {
      base = getTime();
      t0 = performance.now();
    }
  };
  const tick = (now: number) => {
    if (playing) {
      let t = base + (now - t0) / 1000;
      if (t >= duration) {
        base = 0;
        t0 = now;
        t = 0;
      }
      show(t);
    }
    requestAnimationFrame(tick);
  };
  return {
    setPlaying,
    toggle: () => setPlaying(!playing),
    seek(t) {
      base = clamp(t, 0, duration - 1 / fps);
      t0 = performance.now();
      show(base);
    },
    tick,
  };
}

function bindKeys(source: PlayerSource, transport: Transport): void {
  const {film, getTime} = source;
  addEventListener('keydown', e => {
    if (e.key === ' ') {
      e.preventDefault();
      transport.toggle();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      transport.setPlaying(false);
      const step = (e.key === 'ArrowRight' ? 1 : -1) / film.fps;
      transport.seek(getTime() + step);
    } else if (/^[1-9]$/.test(e.key)) {
      const scene = film.scenes[Number(e.key) - 1];
      if (scene) {
        transport.seek(scene.start);
      }
    }
  });
}

/**
 * Adds the player controls to the page and starts playback.
 * @param source Stage, film info and the draw function.
 */
export function startPlayer(source: PlayerSource): void {
  const {film} = source;
  fitStage(source);
  addEventListener('resize', () => fitStage(source));
  const button = h('button', {text: 'pause'});
  const range = h('input', {
    type: 'range',
    min: 0,
    max: film.frames - 1,
    value: 0,
    step: 1,
  });
  const label = h('span', {});
  document.body.append(h('div', {id: 'rw-player'}, button, range, label));
  const transport = createTransport(source, button, range, label);
  button.onclick = transport.toggle;
  range.oninput = () => {
    transport.setPlaying(false);
    transport.seek(Number(range.value) / film.fps);
  };
  bindKeys(source, transport);
  requestAnimationFrame(transport.tick);
}
