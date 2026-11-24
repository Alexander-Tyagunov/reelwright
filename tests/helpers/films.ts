/**
 * @fileoverview Small film specs for the whole-pipeline tests. Each is 4 to
 * 8 s long at 1280x720 so a render takes seconds.
 */
import type {FilmSpec} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {SMALL} from './project.ts';

const OPENING = {type: 'title', duration: 3, title: 'Test film opening'};

const METRIC = {
  type: 'metric',
  duration: 4,
  heading: 'Export time',
  items: [
    {label: 'Before', value: 184, suffix: ' s'},
    {label: 'After', value: 58, suffix: ' s'},
  ],
};

/** A clean three-scene film that uses the `ticker` project scene. */
export function goodFilm(): FilmSpec {
  return {
    meta: {title: 'Good', ...SMALL},
    brand: {theme: 'dark'},
    scenes: [
      {type: 'title', duration: 3, kicker: 'Release', title: 'Faster exports'},
      {
        type: 'bullets',
        duration: 4.6,
        heading: 'What changed',
        items: ['Streaming engine', 'Scheduled reports'],
      },
      {type: 'ticker', duration: 3.6, heading: 'Rows per second', to: 48000},
    ],
  };
}

/** A title card followed by one project scene of the given type. */
export function withScene(
  title: string,
  scene: Record<string, unknown>,
  meta: object = {},
): FilmSpec {
  return {
    meta: {title, ...SMALL, ...meta},
    scenes: [
      {...OPENING, title: `${title} opening`},
      {duration: 4, ...scene} as FilmSpec['scenes'][number],
    ],
  };
}

/** A title card and a metric card: built-in scenes only. */
export function builtInFilm(title: string, meta: object = {}): FilmSpec {
  return {meta: {title, ...SMALL, ...meta}, scenes: [OPENING, METRIC]};
}
