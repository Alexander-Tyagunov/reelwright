/**
 * @fileoverview Builders for the film facts that the gates read. Defaults
 * describe a small 1280x720 film at 30 fps. Times are in seconds.
 */
import type {
  FilmInfo,
  SceneInfo,
  TextInfo,
} from '../../plugin/skills/video/scripts/shared/contract.ts';

/**
 * Builds scenes that follow each other with no overlap.
 *
 * @param durations Seconds on screen for each scene, in order.
 * @param type Scene type used for every scene.
 */
export function scenesOf(durations: number[], type = 'bullets'): SceneInfo[] {
  let start = 0;
  return durations.map((duration, index) => {
    const scene: SceneInfo = {
      index,
      type,
      id: null,
      start,
      end: start + duration,
      duration,
      check: start + duration / 2,
    };
    start += duration;
    return scene;
  });
}

/** Builds one text of a scene. `hold` and `need` are in seconds. */
export function textOf(scene: number, extra: Partial<TextInfo> = {}): TextInfo {
  return {
    scene,
    type: 'bullets',
    text: 'A line of text',
    words: 4,
    settle: 0.5,
    hold: 3,
    need: 1.7,
    ...extra,
  };
}

/** Builds the film facts for scenes of the given durations in seconds. */
export function filmOf(
  durations: number[],
  extra: Partial<FilmInfo> = {},
): FilmInfo {
  const scenes = scenesOf(durations);
  const duration = durations.reduce((a, b) => a + b, 0);
  return {
    title: 'Test film',
    width: 1280,
    height: 720,
    fps: 30,
    duration,
    frames: Math.round(duration * 30),
    loop: false,
    aspect: 'landscape',
    overlap: 0.45,
    globalOverlays: false,
    missingFonts: [],
    warnings: [],
    readingRate: 0.3,
    maxHold: 4,
    scenes,
    texts: [],
    ...extra,
  };
}
