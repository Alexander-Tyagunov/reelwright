/**
 * @fileoverview Assembles the single HTML page: inline CSS, an import map of
 * `data:` URL modules, and a module script that boots the film.
 */
import type {FilmSpec} from '../../shared/contract.ts';
import type {ModuleEntry} from './modules.ts';

/** Key of the runtime entry module in the import map. */
export const ENTRY_KEY = 'reel:/runtime/index.ts';

function escapeHtml(text: string): string {
  const map: Record<string, string> = {'<': '&lt;', '&': '&amp;', '>': '&gt;'};
  return text.replace(/[<&>]/g, c => map[c] ?? c);
}

const LINE_SEPARATOR = /\u2028/g;
const PARAGRAPH_SEPARATOR = /\u2029/g;

/** JSON that is safe inside a script element and valid as JavaScript. */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
}

function moduleUrl(code: string): string {
  const base64 = Buffer.from(code, 'utf8').toString('base64');
  return `data:text/javascript;base64,${base64}`;
}

/** Inputs of {@link buildPage}. */
export interface PageParts {
  title: string;
  /** CSS text with fonts already inlined. */
  css: string;
  /** Every module of the page, including custom scenes. */
  modules: ModuleEntry[];
  /** The spec to boot, with assets inlined and custom scene keys set. */
  spec: FilmSpec;
}

/**
 * Builds the HTML text of the self-contained page.
 *
 * Modules cannot be concatenated, so each one becomes a `data:` URL entry
 * in an import map, and every import specifier already names a key.
 */
export function buildPage(parts: PageParts): string {
  const imports: Record<string, string> = {};
  for (const m of parts.modules) {
    imports[m.key] = moduleUrl(m.code);
  }
  const css = parts.css.replace(/<\/style/gi, '<\\/style');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(parts.title)}</title>
<style>
${css}
</style>
</head>
<body>
<div id="rw-error"></div>
<script type="importmap">${JSON.stringify({imports})}</script>
<script type="module">
import {boot} from '${ENTRY_KEY}';
boot(${safeJson(parts.spec)});
</script>
</body>
</html>
`;
}
