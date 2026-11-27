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
  /** Texts of the scene's labels, in the order they appear. */
  labels?: readonly string[];
}

/** One chapter. */
export interface Chapter {
  /** Whole seconds from the start of the film. */
  at: number;
  title: string;
  /** True when the title is not a scene's own `chapter` field. */
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

/** Characters. A label-made title stops before it passes this length. */
export const TITLE_LENGTH = 60;

/**
 * Joins label texts with ", " and stops at a label boundary before the
 * result passes `TITLE_LENGTH`. The first label is always kept.
 */
function joinLabels(labels: readonly string[]): string {
  let title = '';
  for (const label of labels) {
    const next = title ? `${title}, ${label}` : label;
    if (title && next.length > TITLE_LENGTH) {
      break;
    }
    title = next;
  }
  return title;
}

/** The title of the chapter made of `group`, which has the given number. */
function titleOf(
  group: readonly ChapterScene[],
  number: number,
  filmTitle: string | undefined,
): Chapter['title'] | undefined {
  const authored = group.find(s => s.chapter)?.chapter;
  if (authored) {
    return authored;
  }
  const labels = group.flatMap(s => s.labels ?? []).filter(Boolean);
  if (labels.length) {
    return joinLabels(labels);
  }
  return number === 1 && filmTitle ? filmTitle : `Part ${number}`;
}

/**
 * Chooses the chapters and their titles.
 *
 * If any scene has a `chapter` title, only titled scenes start chapters.
 * Otherwise every scene start that lies at least `min` seconds after the
 * last chapter start, and at least `min` seconds before the end, does. The
 * first chapter always starts at 0. A chapter's title is the `chapter` of its
 * first scene that has one; else the label texts of its scenes, in order,
 * joined with ", " and cut at about 60 characters on a label boundary; else
 * the film title (first chapter) or "Part N".
 *
 * @param scenes Scenes in film order.
 * @param total Length of the film in seconds.
 * @param min Shortest chapter in seconds.
 * @param filmTitle Title of the film, for a first chapter with no labels.
 */
export function makeChapters(
  scenes: readonly ChapterScene[],
  total: number,
  min: number = MIN_CHAPTER_S,
  filmTitle?: string,
): ChapterList {
  const authored = scenes.some(s => s.chapter);
  const groups: ChapterScene[][] = [];
  const starts: number[] = [];
  for (const s of scenes) {
    const at = Math.max(0, Math.round(s.start));
    const lastAt = starts[starts.length - 1];
    const wanted = !authored || Boolean(s.chapter);
    const fits =
      lastAt !== undefined && at - lastAt >= min && total - at >= min;
    if (lastAt === undefined || (wanted && fits)) {
      starts.push(lastAt === undefined ? 0 : at);
      groups.push([s]);
    } else {
      groups[groups.length - 1]?.push(s);
    }
  }
  const chapters = groups.map((group, i) => {
    const title = titleOf(group, i + 1, filmTitle) ?? '';
    return {
      at: starts[i] ?? 0,
      title,
      guessed: !group.some(s => s.chapter),
    };
  });
  const merged = groups.flatMap(group =>
    group
      .slice(1)
      .filter(
        s => s.chapter && s.chapter !== group.find(x => x.chapter)?.chapter,
      )
      .map(s => s.chapter as string),
  );
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
