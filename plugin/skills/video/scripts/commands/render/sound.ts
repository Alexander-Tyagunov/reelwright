/**
 * @fileoverview The sound step of `render`: makes the soundtrack for a film
 * whose `meta.sound` is on.
 */
import {resolveSound} from '../../audio/sound-spec.ts';
import type {OpenFilm} from '../../browser/film.ts';
import type {Args} from '../../core/args.ts';
import {stringFlag} from '../../core/args.ts';
import {outputsOf} from '../../core/outputs.ts';
import type {Soundtrack} from '../../video/soundtrack.ts';
import {makeSoundtrack} from '../../video/soundtrack.ts';

/**
 * Makes the soundtrack for a render.
 *
 * @param args Reads `--no-sound` and `--size`.
 * @returns The soundtrack, or null when the film is silent or `--no-sound`
 *   was given.
 * @throws UserError when `meta.sound` is wrong or ffmpeg cannot measure the
 *   track.
 */
export async function soundForRender(
  film: OpenFilm,
  args: Args,
): Promise<Soundtrack | null> {
  const {spec, info} = film;
  const sound = resolveSound(spec.film.meta?.sound);
  if (!sound || args.flags.sound === false) {
    return null;
  }
  const size = stringFlag(args, 'size');
  return makeSoundtrack({
    info,
    film: spec.film,
    sound,
    names: outputsOf(spec.abs, spec.dir),
    suffix: size ? `-${size}` : '',
  });
}
