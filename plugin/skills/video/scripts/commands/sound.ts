/**
 * @fileoverview `sound`: generates the background sound of a film as
 * `out/sound.wav` and the cue list `out/sound.json`, without rendering any
 * frame.
 */
import {resolveSound} from '../audio/sound-spec.ts';
import {openFilm} from '../browser/film.ts';
import type {Args} from '../core/args.ts';
import {boolFlag, stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {outputsOf} from '../core/outputs.ts';
import type {SoundSpec} from '../shared/contract.ts';
import {makeSoundtrack} from '../video/soundtrack.ts';

function chosenSound(raw: boolean | SoundSpec | undefined, palette?: string) {
  if (palette === undefined) {
    return resolveSound(raw);
  }
  const base = typeof raw === 'object' ? raw : {};
  return resolveSound({...base, palette});
}

/**
 * Generates the sound for a film: a bed and cues timed to the scenes and
 * texts, set to -14 LUFS with the true peak at or below -1.5 dBTP, as long
 * as the film. Prints the length, the cue count and the measured levels.
 *
 * @param args `sound film.json [--size WxH] [--palette name] [--gpu]`.
 *   `--palette` replaces `meta.sound.palette` and turns sound on for this
 *   run.
 * @returns 0.
 * @throws UserError when `meta.sound` is off and no palette is given, or the
 *   spec's sound settings are wrong.
 */
export async function run(args: Args): Promise<number> {
  const size = stringFlag(args, 'size');
  const film = await openFilm(args.positional[0], {
    size,
    gpu: boolFlag(args, 'gpu'),
  });
  try {
    const {info, spec} = film;
    const sound = chosenSound(
      spec.film.meta?.sound,
      stringFlag(args, 'palette'),
    );
    if (!sound) {
      throw new UserError(
        'sound is off. Set "sound": true in meta of film.json, or pass ' +
          '--palette calm to try a palette.',
      );
    }
    const made = await makeSoundtrack({
      info,
      film: spec.film,
      sound,
      names: outputsOf(spec.abs, spec.dir),
      suffix: size ? `-${size}` : '',
    });
    const {lufs, truePeak} = made.loudness;
    console.log(`sound: ${made.file}`);
    console.log(
      `  palette ${made.palette}, ${made.duration}s, ${made.cues.length} cues`,
    );
    console.log(
      `  ${lufs.toFixed(1)} LUFS integrated, true peak ${truePeak.toFixed(1)} dBTP`,
    );
    console.log(`  cue list: ${made.json}`);
    return 0;
  } finally {
    await film.close();
  }
}
