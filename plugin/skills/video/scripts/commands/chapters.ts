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

/** Chapters a video site needs before it shows any. */
const MIN_CHAPTERS = 3;

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Texts of a scene's labels, by the time each appears. */
function labelTexts(scene: SceneSpec): string[] {
  const labels = Array.isArray(scene.labels) ? scene.labels : [];
  return labels
    .filter(
      (l): l is Record<string, unknown> => typeof l === 'object' && l !== null,
    )
    .sort((a, b) => Number(a.from ?? 0) - Number(b.from ?? 0))
    .map(l => textOf(l.text))
    .filter((x): x is string => x !== undefined);
}

/**
 * Prints `m:ss Title` lines, the first at 0:00. Chapters start at scene
 * starts and last at least `--min` seconds (default 10), so a scene that is
 * too short joins the chapter before it. A title is the `chapter` of the
 * chapter's first scene that has one; else the label texts of its scenes,
 * about 60 characters at most; else the film title or "Part N". When any
 * scene has a `chapter`, only those scenes start chapters.
 *
 * @param args `chapters film.json [--min S] [--json]`.
 * @returns 0. A film with fewer than 3 chapters prints nothing to stdout and
 *   explains on stderr that it gets none.
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
      labels: labelTexts(scene),
    };
  });
  const {chapters, merged} = makeChapters(
    scenes,
    timeline.duration,
    min,
    textOf(spec.film.meta?.title),
  );
  if (chapters.length < MIN_CHAPTERS) {
    console.error(
      `no chapters: only ${chapters.length} of ${min} s or more fit in this ` +
        `${clock(timeline.duration)} film, and a video site needs at least ` +
        `${MIN_CHAPTERS}. Nothing was printed; leave chapters out of the ` +
        'description. To get them, lengthen the film or lower --min.',
    );
    return 0;
  }
  if (args.flags.json === true) {
    console.log(JSON.stringify(chapters, null, 2));
  } else {
    for (const c of chapters) {
      console.log(`${clock(c.at)} ${c.title}`);
    }
  }
  report(
    chapters.some(c => c.guessed),
    merged,
    min,
  );
  return 0;
}

function report(guessed: boolean, merged: string[], min: number) {
  if (guessed) {
    console.error(
      'some titles come from label text, the film title or a part number; ' +
        'add a "chapter" ' +
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
