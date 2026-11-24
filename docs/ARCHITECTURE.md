# Architecture

Reelwright turns a JSON film spec into an MP4. This document is the contract for anyone, human or agent, who
changes the code.

## Repository layout

```
/                       development workspace (not shipped)
  CLAUDE.md             conventions for agents and contributors
  package.json          dev tooling only: TypeScript, Biome
  tsconfig.json         Node-side code and tests
  tsconfig.runtime.json browser-side code (DOM lib)
  biome.json            formatter and linter (ts.dev conventions)
  docs/                 architecture, known issues, research, testing, submission
  tests/unit/           business rules, no browser needed
  tests/e2e/            whole-pipeline scenarios (need Chrome and ffmpeg)
  .claude-plugin/marketplace.json   lists ./plugin
  plugin/               THE INSTALLABLE PLUGIN (only this folder reaches users)
    .claude-plugin/plugin.json, icon.png
    README.md, LICENSE
    agents/reel-*.md
    skills/<skill>/SKILL.md
    skills/video/       the engine lives inside this skill so every surface can reach it
      references/*.md
      templates/<name>/film.json
      scripts/          TypeScript, run directly by Node 24 (no build step)
        reel.ts         CLI entry
        commands/       one file per command
        core/           args, errors, process, cleanup on stop, option checks, hashing, spec loading, paths
        browser/        Chrome discovery, DevTools Protocol session, film page
        server/         static server and on-the-fly type stripping
        video/          ffmpeg encoder, probe, contact sheet, loudness
        qa/             one file per gate, thresholds, report
        shared/         types used by both Node code and the browser runtime
        runtime/        browser code: ES modules, DOM, no Node APIs
          scenes/       one file per scene type
          fonts/        bundled fonts (SIL OFL)
```

Why the engine sits in `skills/video/`: chat on claude.ai copies only a skill's own folder into its sandbox, and
Cowork and Claude Code expand `${CLAUDE_SKILL_DIR}`. Agents and other skills reach it at
`${CLAUDE_PLUGIN_ROOT}/skills/video/` or `${CLAUDE_SKILL_DIR}/../video/`.

Why dev tooling stays out of `plugin/`: a `package.json` with a lockfile at a plugin root makes Claude Code
install packages on every user's machine, and a `CLAUDE.md` at a plugin root is not loaded.

## Hard rules

1. **No runtime dependencies.** The plugin uses Node built-ins, `ffmpeg`/`ffprobe` and a Chromium-family
   browser. `devDependencies` exist only at the repository root.
2. **Pure TypeScript, erasable syntax only.** Node strips types; nothing is compiled. So: no `enum`, no
   `namespace`, no parameter properties, no decorators. Imports use explicit `.ts` extensions and `import type`
   for types.
3. **Every frame is a pure function of time.** `renderAt(t)` uses no clock, no unseeded randomness and no state
   from an earlier frame. The determinism gate enforces it.
4. **Nothing goes through a shell.** Subprocesses get argument arrays.
5. **The server binds to 127.0.0.1 and serves only the runtime and the project folder.** It refuses hidden
   files, links that resolve outside those folders, and requests whose Host is not 127.0.0.1 or localhost.
6. **No network access, no telemetry.**

## Code style

- ts.dev (Google TypeScript style), enforced by Biome: 2 spaces, single quotes, semicolons, 80 columns, named
  exports only, `const` by default, no `any`, no non-null assertion.
- File size: aim for under 200 lines, never over 300. One responsibility per file. Functions under 40 lines.
- Names: `camelCase` values, `PascalCase` types, `CONSTANT_CASE` module constants, kebab-case file names.
- **TSDoc** on every exported symbol and a `@fileoverview` block at the top of every file, written for someone
  hovering in an IDE: what it is, what it guarantees, units of every number.
- Comments inside functions are rare. When one is needed it is one line of Simplified Technical English
  (ASD-STE100): short, active voice, one idea. No commented-out code. No code in comments.
- No reference to any outside article, post, person or product as a source of an idea, anywhere in code.
- Errors a user can cause are `UserError` with a message that says what to do next.

## Contracts

`shared/contract.ts` defines the shapes that cross the Node/browser boundary:

- `FilmSpec` — the `film.json` document.
- `FilmInfo` — `window.__film`, published by the runtime once the page is ready.
- `LayoutReport` — returned by `window.__layoutReport()`.
- The page globals: `window.renderAt(t)`, `window.__ready`, `window.__errors`.

Scene modules register through `registerScene(type, factory)` from `runtime/registry.ts`. A project's custom
scene files use the same function through the global `Reel` object.

## Server routes

| Route | Serves |
|---|---|
| `/` | the film page |
| `/__reel/*` | files under `scripts/runtime/` and `scripts/shared/`; `.ts` is served type-stripped as JavaScript |
| `/__film.json` | the spec, read fresh on every request |
| anything else | the project folder; `.ts` files are type-stripped |

## CSS

Classes use the `rw-` prefix (`rw-h1`, `rw-card`); data attributes use `data-rw-*`. Sizes are in `--u` (1% of
the short side). Colours come only from the brand variables.

## Testing

- `npm test`: unit tests of business rules (timeline maths, reading holds, freeze detection, cache
  invalidation, contrast, argument parsing). No browser.
- `npm run test:e2e`: scenario tests through the real CLI: seeded-defect films that each gate must catch, the
  templates at three aspect ratios, export, single-file build, init and doctor. Skipped with a clear message
  when Chrome or ffmpeg is missing.
- A test exists because a real user scenario or a known edge case needs it. Each test name states the scenario.
- `npm run check` = typecheck + lint + unit tests. It must pass before any change is finished.
