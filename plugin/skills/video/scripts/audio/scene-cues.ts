/**
 * @fileoverview Reads and checks the explicit `cues` list of a scene.
 */
import {UserError} from '../core/errors.ts';
import {checkPositive, checkRange} from '../core/validate.ts';
import type {CueKind, SceneCue, SceneSpec} from '../shared/contract.ts';

/** Every cue kind, in the order they are listed to users. */
export const CUE_KINDS: readonly CueKind[] = [
  'tick',
  'whoosh',
  'rise',
  'chime',
  'hit',
  'boom',
  'pop',
  'sting',
];

function isKind(value: unknown): value is CueKind {
  return typeof value === 'string' && CUE_KINDS.includes(value as CueKind);
}

function checkCue(label: string, raw: unknown, length: number): SceneCue {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  if (!isKind(o.kind)) {
    throw new UserError(
      `${label}.kind must be one of: ${CUE_KINDS.join(', ')}; ` +
        `got ${JSON.stringify(o.kind)}`,
    );
  }
  const cue: SceneCue = {
    at: checkRange(`${label}.at`, o.at, 0, length),
    kind: o.kind,
  };
  if (o.gain !== undefined) {
    cue.gain = checkRange(`${label}.gain`, o.gain, 0, 1);
  }
  if (o.duration !== undefined) {
    if (o.kind !== 'rise') {
      throw new UserError(
        `${label}.duration is only for "rise" cues. Remove it from "${o.kind}".`,
      );
    }
    cue.duration = checkPositive(`${label}.duration`, o.duration);
  }
  return cue;
}

/**
 * Checks the `cues` of one scene.
 *
 * @param scene The scene spec. Its `duration` is in seconds.
 * @param index Scene index from 0, used in messages.
 * @returns The cues, or an empty list when the scene has none.
 * @throws UserError naming the scene and the field when a cue is wrong.
 */
export function sceneCues(scene: SceneSpec, index: number): SceneCue[] {
  if (scene.cues === undefined) {
    return [];
  }
  const label = `scenes[${index}].cues`;
  if (!Array.isArray(scene.cues)) {
    throw new UserError(
      `${label} must be a list of {"at": seconds, "kind": "tick"} objects`,
    );
  }
  const length = typeof scene.duration === 'number' ? scene.duration : 0;
  return scene.cues.map((c, i) => checkCue(`${label}[${i}]`, c, length));
}
