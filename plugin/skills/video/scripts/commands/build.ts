/**
 * @fileoverview `build`: bundles a film into one self-contained HTML file.
 * The runtime, scenes, fonts, images and spec are all inside it.
 */
import {mkdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pageErrors, waitUntilReady} from '../browser/film.ts';
import {launch} from '../browser/launch.ts';
import type {Args} from '../core/args.ts';
import {stringFlag} from '../core/args.ts';
import {UserError} from '../core/errors.ts';
import {frameSize, loadSpec} from '../core/spec.ts';
import type {FilmInfo} from '../shared/contract.ts';
import {inlinedCss, inlineSpecAssets} from './build/assets.ts';
import {projectModules, runtimeModules} from './build/modules.ts';
import {buildPage} from './build/page.ts';

/** Opens the built file from a file:// address and checks it boots. */
async function verify(out: string, size: {width: number; height: number}) {
  const browser = await launch();
  try {
    const page = await browser.newPage(size);
    await page.send('Page.navigate', {
      url: `${pathToFileURL(out).href}?render=1`,
    });
    const ready = await waitUntilReady(page);
    const errors = await pageErrors(page);
    if (ready !== true || errors.length) {
      const detail = errors.join('\n  ') || 'no error was reported';
      throw new UserError(
        'the built file did not load cleanly from file:// ' +
          `(ready=${ready}).\n  ${detail}`,
      );
    }
    const info = (await page.eval('window.__film')) as FilmInfo;
    console.log(
      `  verified in headless Chrome from file://: ready, ` +
        `${info.scenes.length} scenes, ${info.duration}s, no page errors`,
    );
    if (info.missingFonts?.length) {
      console.log(
        `warning: fonts not available: ${info.missingFonts.join(', ')}`,
      );
    }
  } finally {
    await browser.close();
  }
}

/**
 * Writes `out/film.html` next to the spec (or `--out`) and checks it from a
 * file:// address in headless Chrome.
 *
 * @param args `build film.json [--out file.html] [--size WxH]`.
 * @returns 0.
 * @throws UserError when a custom scene file is missing, the film has a
 *   plate scene, or the built file does not load cleanly.
 */
export async function run(args: Args): Promise<number> {
  const spec = loadSpec(args.positional[0]);
  if (spec.film.scenes.some(s => s.type === 'plate')) {
    throw new UserError(
      'a film with a plate scene cannot be bundled into one HTML file, ' +
        'because a plate is a folder of many frame files. Use `render` ' +
        'to make an MP4 instead.',
    );
  }
  const outArg = stringFlag(args, 'out');
  const out = outArg ? resolve(outArg) : join(spec.dir, 'out', 'film.html');
  const inlined = inlineSpecAssets(spec.film, spec.dir);
  const project = projectModules(spec.dir, spec.film.customScenes ?? []);
  inlined.spec.customScenes = project.sceneKeys;
  const modules = [...runtimeModules(), ...project.entries];
  const html = buildPage({
    title: spec.film.meta?.title ?? 'Reelwright',
    css: inlinedCss(),
    modules,
    spec: inlined.spec,
  });
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, html);
  const mb = (statSync(out).size / 1048576).toFixed(2);
  const plural = (n: number, w: string): string =>
    `${n} ${w}${n === 1 ? '' : 's'}`;
  const runtime = modules.length - project.entries.length;
  console.log(`built ${out}`);
  console.log(
    `  ${mb} MB; ${plural(runtime, 'runtime module')}, ` +
      `${plural(project.sceneKeys.length, 'custom scene script')}, ` +
      `${plural(inlined.images, 'image reference')} inlined, ` +
      `${plural(inlined.fonts, 'font file')} inlined`,
  );
  for (const m of inlined.missing) {
    console.log(
      `warning: "${m}" was not found in the project folder; left as a path, ` +
        'it will not show when the file is moved',
    );
  }
  await verify(out, frameSize(spec.film, stringFlag(args, 'size')));
  return 0;
}
