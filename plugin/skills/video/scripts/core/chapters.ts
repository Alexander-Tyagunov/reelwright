/**
 * @fileoverview Video chapters from the scene starts of a film. Pure: no
 * files, no browser. A chapter list for a video site starts at 0:00 and every
 * chapter lasts at least 10 seconds, so short scenes join the chapter before.
 */

/** What a scene gives to chapter making. */
export interface ChapterScene {
  /** Film time at which the scene starts, in seconds. */
  start: number;
  /** The scene's own chapter title, if its spec has one. */
  chapter?: string;
  /** A title found in the scene's text, used when it has no `chapter`. */
  fallback?: string;
}

/** One chapter. */
export interface Chapter {
  /** Whole seconds from the start of the film. */
  at: number;
  title: string;
  /** True when the title came from the scene's text, not its `chapter`. */
  guessed: boolean;
}

/** The result of chapter making. */
export interface ChapterList {
  chapters: Chapter[];
  /** Titled scenes that were too close to the chapter before them. */
  merged: string[];
}

/** Seconds. The shortest chapter a video site accepts. */
export const MIN_CHAPTER_S = 10;

/**
 * Chooses the chapters.
 *
 * If any scene has a `chapter` title, only titled scenes start chapters.
 * Otherwise every scene start that lies at least `min` seconds after the
 * last chapter start, and at least `min` seconds before the end, does. The
 * first chapter always starts at 0.
 *
 * @param scenes Scenes in film order.
 * @param total Length of the film in seconds.
 * @param min Shortest chapter in seconds.
 */
export function makeChapters(
  scenes: readonly ChapterScene[],
  total: number,
  min: number = MIN_CHAPTER_S,
): ChapterList {
  const authored = scenes.some(s => s.chapter);
  const chapters: Chapter[] = [];
  const merged: string[] = [];
  scenes.forEach((s, i) => {
    const at = Math.max(0, Math.round(s.start));
    const title = s.chapter ?? s.fallback ?? `Part ${i + 1}`;
    const last = chapters[chapters.length - 1];
    if (!last) {
      chapters.push({at: 0, title, guessed: !s.chapter});
      return;
    }
    if (authored && !s.chapter) {
      return;
    }
    if (at - last.at >= min && total - at >= min) {
      chapters.push({at, title, guessed: !s.chapter});
    } else if (s.chapter) {
      merged.push(s.chapter);
    }
  });
  return {chapters, merged};
}

/**
 * Writes seconds as `m:ss`, or `h:mm:ss` from one hour.
 *
 * @param seconds Whole seconds.
 */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
