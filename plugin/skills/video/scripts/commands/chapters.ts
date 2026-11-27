/**
 * @fileoverview `chapters`: prints video chapters from the scene starts of a
 * film spec, ready to paste into a video description.
 */
import type {Args} from '../core/args.ts';
import {numberFlag} from '../core/args.ts';
import type {ChapterScene} from '../core/chapters.ts';
import {clock, MIN_CHAPTER_S, makeChapters} from '../core/chapters.ts';
import {filmTimeline} from '../core/film-timeline.ts';
import {loadSpec} from '../core/spec.ts';
import {checkPositive} from '../core/validate.ts';
import type {SceneSpec} from '../shared/contract.ts';

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** The first label by time, the `title` field or the id of a scene. */
function fallbackTitle(scene: SceneSpec): string | undefined {
  const labels = Array.isArray(scene.labels) ? scene.labels : [];
  const first = labels
    .filter(
      (l): l is Record<string, unknown> => typeof l === 'object' && l !== null,
    )
    .sort((a, b) => Number(a.from ?? 0) - Number(b.from ?? 0))[0];
  return textOf(first?.text) ?? textOf(scene.title) ?? textOf(scene.id);
}

/**
 * Prints `m:ss Title` lines, the first at 0:00. Chapters start at scene
 * starts and last at least `--min` seconds (default 10), so a scene that is
 * too short joins the chapter before it. Titles come from the scene's
 * `chapter` field; a scene without one gives its first label, `title` or
 * `id`. When any scene has a `chapter`, only those scenes start chapters.
 *
 * @param args `chapters film.json [--min S] [--json]`.
 * @returns 0 once the chapters are printed.
 * @throws UserError for a missing spec, an invalid scene duration or a
 *   `--min` that is not a positive number.
 */
export async function run(args: Args): Promise<number> {
  const spec = loadSpec(args.positional[0]);
  const min = numberFlag(args, 'min', 'seconds') ?? MIN_CHAPTER_S;
  checkPositive('--min', min);
  const timeline = filmTimeline(spec.film);
  const scenes: ChapterScene[] = timeline.slots.map(slot => {
    const scene = spec.film.scenes[slot.index] as SceneSpec;
    return {
      start: slot.start,
      chapter: textOf(scene.chapter),
      fallback: fallbackTitle(scene),
    };
  });
  const {chapters, merged} = makeChapters(scenes, timeline.duration, min);
  if (args.flags.json === true) {
    console.log(JSON.stringify(chapters, null, 2));
  } else {
    for (const c of chapters) {
      console.log(`${clock(c.at)} ${c.title}`);
    }
  }
  report(
    chapters.length,
    chapters.some(c => c.guessed),
    merged,
    min,
  );
  return 0;
}

function report(
  count: number,
  guessed: boolean,
  merged: string[],
  min: number,
) {
  if (count < 3) {
    console.error(
      `only ${count} chapter(s) fit: a video site needs at least 3 of ` +
        `${min} s. Lengthen the film or lower --min.`,
    );
  }
  if (guessed) {
    console.error(
      'some titles come from label text or scene ids; add a "chapter" ' +
        'title to the scenes (or to the shots of the plan) to name them.',
    );
  }
  if (merged.length) {
    console.error(
      `not a chapter, closer than ${min} s to the one before: ` +
        merged.join(', '),
    );
  }
}
