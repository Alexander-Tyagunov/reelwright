/**
 * @fileoverview Formats of a plan and where the plates of each format live.
 * The first format of a plan uses `plates/<shot>`; every other format uses
 * `plates/<shot>@9x16`, the format name with `:` written as `x`.
 */
import {UserError} from '../core/errors.ts';
import type {PlanShot, ShotPlan} from './types.ts';

/** A chosen format: its name, its size and the suffix of its plate folders. */
export interface PlanFormat {
  /** Name such as `16:9`. */
  name: string;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** Text added to a plate folder name: empty for the first format. */
  suffix: string;
}

/**
 * Picks a format of the plan.
 *
 * @param name Format name such as `9:16`; absent picks the first format.
 * @throws UserError when the plan has no such format.
 */
export function chooseFormat(plan: ShotPlan, name?: string): PlanFormat {
  const names = Object.keys(plan.formats);
  const pick = name ?? names[0] ?? '16:9';
  const size = plan.formats[pick];
  if (!size) {
    throw new UserError(
      `the plan has no format "${pick}"; it has ${names.join(', ')}. ` +
        'Add the format to "formats" in the plan or choose one of those.',
    );
  }
  const suffix = pick === names[0] ? '' : `@${pick.replace(':', 'x')}`;
  return {name: pick, width: size[0], height: size[1], suffix};
}

/** Folder of a shot's plate in the first format, without a trailing slash. */
export function plateFolder(shot: Pick<PlanShot, 'id' | 'plate'>): string {
  return (shot.plate ?? `plates/${shot.id}`).replace(/\/+$/, '');
}

/** Adds the format's suffix to a plate folder unless it already ends so. */
export function inFormat(folder: string, format: PlanFormat): string {
  const bare = folder.replace(/\/+$/, '');
  return bare.endsWith(format.suffix) ? bare : bare + format.suffix;
}
