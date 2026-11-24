/**
 * @fileoverview Absolute paths of the engine's folders. They are computed
 * from this file's location, so they work wherever the skill is installed.
 */
import {join, resolve} from 'node:path';

/** The `scripts` folder: parent of `reel.ts`, `core`, `runtime`, `shared`. */
export const SCRIPTS_DIR: string = resolve(import.meta.dirname, '..');

/** The `skills/video` folder: scripts, templates and references. */
export const ENGINE_ROOT: string = resolve(SCRIPTS_DIR, '..');

/** Browser code served to the film page, and the fonts and CSS it uses. */
export const RUNTIME_DIR: string = join(SCRIPTS_DIR, 'runtime');

/** Types and helpers used by both Node code and the browser runtime. */
export const SHARED_DIR: string = join(SCRIPTS_DIR, 'shared');

/** Folders that `reel init` copies new projects from. */
export const TEMPLATES_DIR: string = join(ENGINE_ROOT, 'templates');

/** The CLI entry file, used to print runnable next-step commands. */
export const REEL_ENTRY: string = join(SCRIPTS_DIR, 'reel.ts');
