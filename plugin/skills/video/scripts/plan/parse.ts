/**
 * @fileoverview Reads a shot plan document and checks the fields the engine
 * uses. Fields it does not know stay on the objects it returns, so the 3D
 * side can keep its own data in the same file.
 */
import {CUE_KINDS} from '../audio/scene-cues.ts';
import type {Problems, Raw} from './problems.ts';
import {isCount, isNum, isRaw, isText, problems} from './problems.ts';
import type {PlanShot, ShotPlan} from './types.ts';

/** Poses per second when the plan names none. */
export const DEFAULT_POSE_RATE = 12;

/** Film frames per second when the plan names none. */
export const DEFAULT_FILM_FPS = 24;

/** The one format of a plan that names none, in pixels. */
export const DEFAULT_FORMATS: ShotPlan['formats'] = {'16:9': [1920, 1080]};

function checkLabel(p: Problems, at: string, raw: unknown): void {
  if (!isRaw(raw)) {
    p.add(at, 'must be an object');
    return;
  }
  for (const key of ['track', 'text', 'sub'] as const) {
    if (typeof raw[key] !== 'string' || (key !== 'sub' && !raw[key])) {
      p.add(`${at}.${key}`, 'must be text');
    }
  }
  const {from_pose: from, to_pose: to} = raw;
  if (!isCount(from) || !isCount(to) || from > to) {
    p.add(at, 'from_pose and to_pose must be whole numbers, from_pose first');
  }
  if (raw.line !== undefined && typeof raw.line !== 'string') {
    p.add(`${at}.line`, 'must be text');
  }
}

function checkCue(p: Problems, at: string, raw: unknown): void {
  const cue = isRaw(raw) ? raw : {};
  if (!CUE_KINDS.includes(cue.kind as never)) {
    p.add(`${at}.kind`, `must be one of ${CUE_KINDS.join(', ')}`);
  }
  if (!isCount(cue.pose)) {
    p.add(`${at}.pose`, 'must be a whole number from 1');
  }
  if (!isNum(cue.gain) || cue.gain <= 0 || cue.gain > 1) {
    p.add(`${at}.gain`, 'must be a number above 0 and up to 1');
  }
}

function checkList(
  p: Problems,
  at: string,
  value: unknown,
  each: (at: string, item: unknown) => void,
): void {
  if (!Array.isArray(value)) {
    p.add(at, 'must be a list');
    return;
  }
  for (const [i, item] of value.entries()) {
    each(`${at}[${i}]`, item);
  }
}

function checkEvent(p: Problems, at: string, raw: unknown): void {
  const ev = isRaw(raw) ? raw : {};
  if (!isText(ev.name) || !isCount(ev.pose)) {
    p.add(at, 'must be {name, pose} with a pose counted from 1');
  }
}

function checkShot(p: Problems, at: string, raw: unknown): void {
  if (!isRaw(raw)) {
    p.add(at, 'must be an object');
    return;
  }
  if (!isText(raw.id)) {
    p.add(`${at}.id`, 'must be text');
  }
  if (!isCount(raw.poses)) {
    p.add(`${at}.poses`, 'must be a whole number from 1');
  }
  if (!Array.isArray(raw.tracks) || raw.tracks.some(t => !isText(t))) {
    p.add(`${at}.tracks`, 'must be a list of track names');
  }
  checkList(p, `${at}.labels`, raw.labels, (a, l) => checkLabel(p, a, l));
  checkList(p, `${at}.cues`, raw.cues, (a, c) => checkCue(p, a, c));
  checkList(p, `${at}.events`, raw.events ?? [], (a, e) => checkEvent(p, a, e));
  for (const key of ['plate', 'chapter'] as const) {
    if (raw[key] !== undefined && !isText(raw[key])) {
      p.add(`${at}.${key}`, 'must be text');
    }
  }
}

function sizeOk(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every(n => Number.isInteger(n) && n >= 16 && n % 2 === 0)
  );
}

function checkFormats(p: Problems, value: unknown): void {
  if (value === undefined) {
    return;
  }
  const sizes = isRaw(value) ? Object.entries(value) : [];
  if (
    !sizes.length ||
    sizes.some(([k, v]) => !/^\d+:\d+$/.test(k) || !sizeOk(v))
  ) {
    p.add(
      'formats',
      'must map names such as "16:9" to [width, height] in pixels, both even',
    );
  }
}

function checkSound(p: Problems, value: unknown): void {
  const pts = isRaw(value) ? value.intensity : undefined;
  const bad =
    !Array.isArray(pts) ||
    pts.length < 2 ||
    pts.some(q => !isRaw(q) || !isNum(q.at_s) || !isNum(q.value));
  if (bad) {
    p.add('sound.intensity', 'must list at least 2 points {at_s, value}');
  }
}

function checkTop(p: Problems, doc: Raw): void {
  if (!isText(doc.title)) {
    p.add('title', 'must be text');
  }
  for (const key of ['fps_poses', 'film_fps'] as const) {
    if (doc[key] !== undefined && !isCount(doc[key])) {
      p.add(key, 'must be a whole number from 1');
    }
  }
  checkFormats(p, doc.formats);
  checkSound(p, doc.sound);
  if (!Array.isArray(doc.sequences) || !doc.sequences.length) {
    p.add('sequences', 'must be a list with at least one sequence');
  }
}

function checkSequences(p: Problems, doc: Raw): void {
  const seen = new Set<string>();
  const list = Array.isArray(doc.sequences) ? doc.sequences : [];
  list.forEach((seq, i) => {
    const at = `sequences[${i}]`;
    if (!isRaw(seq) || !Array.isArray(seq.shots) || !isText(seq.id)) {
      p.add(at, 'must be {id, shots: [...]}');
      return;
    }
    seq.shots.forEach((shot, j) => {
      checkShot(p, `${at}.shots[${j}]`, shot);
      const id = isRaw(shot) ? String(shot.id) : '';
      if (seen.has(id)) {
        p.add(`${at}.shots[${j}].id`, `"${id}" is used by two shots`);
      }
      seen.add(id);
    });
  });
}

/**
 * Checks a parsed plan and returns it typed, with the defaults for the pose
 * rate, the film rate and the formats filled in. Unknown fields are kept.
 *
 * @param doc The parsed JSON.
 * @param file Name for messages, usually the path of the plan.
 * @throws UserError that lists up to 12 problems, each with its path in the
 *   document, and says to correct the plan and run again.
 */
export function parsePlan(doc: unknown, file: string): ShotPlan {
  const p = problems();
  if (!isRaw(doc)) {
    p.add('plan', 'must be a JSON object');
    p.throwIfAny(file, 'Start from the example in shot-plan.md.');
  }
  const raw = doc as Raw;
  checkTop(p, raw);
  checkSequences(p, raw);
  p.throwIfAny(file, 'Correct the plan, then run the command again.');
  return {
    ...raw,
    fps_poses: raw.fps_poses ?? DEFAULT_POSE_RATE,
    film_fps: raw.film_fps ?? DEFAULT_FILM_FPS,
    formats: raw.formats ?? DEFAULT_FORMATS,
  } as unknown as ShotPlan;
}

/** Lists every shot of a plan in film order. */
export function allShots(plan: ShotPlan): PlanShot[] {
  return plan.sequences.flatMap(s => s.shots);
}
