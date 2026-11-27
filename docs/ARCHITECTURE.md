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
    agents/reel-*.md      eight agents
    skills/<skill>/SKILL.md   nine skills; film, studio and publish have references/ of their own
    skills/video/       the engine lives inside this skill so every surface can reach it
      references/*.md
      blender/          reel_blender/ (Python library, same version as the plugin) and examples/paper_desk/ (an example film project)
      templates/<name>/film.json
      scripts/          TypeScript, run directly by Node 24 (no build step)
        reel.ts         CLI entry
        commands/       one file per command
        core/           args, errors, process, cleanup on stop, option checks, hashing, spec loading, paths, output names (`outputs.ts`)
        browser/        Chrome discovery, DevTools Protocol session, film page
        server/         static server and on-the-fly type stripping
        video/          ffmpeg encoder, probe, contact sheet, loudness, soundtrack files (`soundtrack.ts`), frame
                        brightness (`brightness.ts`), momentary loudness (`momentary.ts`)
        audio/          generated sound, pure arithmetic on Float32Array, no Web Audio: oscillators, envelopes, filters,
                        noise, reverb, soft limiter, WAV writer, seeded random, scales and chords, bed, cue sounds,
                        palettes, cue planning, `meta.sound` checks. Imports nothing from the browser or from ffmpeg.
        plan/           shot plan: types, parse, load (plan and side files), checks (`reel plan`), scenes, sound curve,
                        assemble (`reel assemble`). Reads the plan; writes a spec; no browser
        qa/             one file per gate, thresholds, report; cuts (`cuts.ts` pure, `cuts-run.ts` reads a video),
                        brightness runs of a plate (`brightness-runs.ts`, `plate-brightness.ts`)
        shared/         types and pure helpers used by both Node code and the browser runtime (`plate.ts`: the plate data contract)
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
- `FilmInfo` — `window.__film`, published by the runtime once the page is ready. It carries `warnings`, load-time
  facts that are not errors (a plate shorter than its scene).
- `LayoutReport` — returned by `window.__layoutReport()`.
- The page globals: `window.renderAt(t)`, `window.__settle()`, `window.__ready`, `window.__errors`.
  `renderAt` is synchronous. `__settle` resolves once every picture the drawn frame needs is decoded, and Node
  code awaits it after every `renderAt` through `drawAt` in `browser/film.ts` before it captures.
- `shared/plate.ts` — the `tracks.json` format of a plate: parsing, the time-to-frame map and frame file names.
  The runtime, the `plate` command, the render cache key and the tests all read it, so there is one definition.

Scene modules register through `registerScene(type, factory)` from `runtime/registry.ts`. A project's custom
scene files use the same function through the global `Reel` object.

A factory cannot wait, so a scene type that needs a file before it can be built registers a preloader with
`registerPreload(type, fn)` (`runtime/preload.ts`). `mount` awaits every preloader, in scene order, before any
factory runs; an error is reported as `scene N (type): ...` and fails the load gate. A scene that loads pictures at
draw time registers a settler with `registerSettler` (`runtime/settle.ts`), which `__settle` awaits. A scene that
paints a picture the stylesheet cannot see registers a backdrop sampler (`runtime/backdrop.ts`), which the layout
report uses to find the colour behind a text. Text that moves with a picture declares its speed with `ctx.motion`.

The `plate` scene is the one user of all four. Its files are `runtime/scenes/plate.ts` and
`runtime/scenes/lib/plate-*.ts`: `-spec` (fields, pure), `-place` (geometry, pure), `-load` (preload), `-frames`
(decoded frame cache), `-labels`, `-texts` and `-sample` (contrast sampling). The cache key of a plate scene is in
`core/plate-stamp.ts`.

## Shot plans, cuts and chapters

`plan/` turns a shot plan (`references/shot-plan.md`) into a film spec. `parse.ts` checks the fields the engine reads and
keeps every other field, so the 3D side can share the file. `load.ts` reads the plan and the files beside it. `scenes.ts`,
`scene-labels.ts`, `cue-list.ts` and `sound.ts` build the scenes and `meta.sound`; `assemble.ts` joins them. `checks.ts`,
`check-labels.ts` and `check-plates.ts` are `reel plan`. Plate folders are relative to the folder of the written spec;
a second format uses `<folder>@9x16`.

`core/film-timeline.ts` computes scene starts without a page (it calls `runtime/timeline.ts`, which is DOM-free). `reel
cuts` and `reel chapters` use it. `qa/gates/cuts.ts` is a gate that only warns and turns a read failure into a warning.
`core/chapters.ts` is pure; it chooses chapter starts and titles (a `chapter` field, else the scenes' label texts up to
about 60 characters, else the film title or "Part N").

## The Blender library

`plugin/skills/video/blender/reel_blender/` renders plates; the engine never imports it. The two sides meet in two files: the
shot plan (`references/shot-plan.md` lists the fields each side reads; the library reads the plan only through `plan.py`, the twin of
`plan/parse.ts`: same shot-id rule, same plate-folder rule) and the plate (`tracks.json` and frames, `references/film-spec.md`). `film.py` (the public calls, over `film_state.py`, `film_camera.py`, `film_shot.py` and `film_queue.py`), `lettering.py`, `stills.py` and
`checks.py` came in 0.2.0; the first runs inside Blender, the others in the workspace with Pillow and numpy. The library holds
no look and no project path. `examples/paper_desk/` shows one look module and one shot module on top of it.

## Skills, agents and the film path

Nine skills. `film` is the main path and names the agent for each of its twelve steps; `studio` keeps the owner's profile and
look ledger, which `film` and `publish` read first; `publish` prepares the upload kit and never uploads. `video` holds the engine
and the references the others read; `release-video`, `metrics-video`, `explainer-video`, `check-film` and `add-scene` are
recipes on it. Eight agents, each pinned to a model tier (`references/model-routing.md`): `reel-director` (pitches, treatment,
plan), `reel-animator` (one sequence in Blender at a time), `reel-builder` (assembly, gates, side-file fixes), `reel-critic` (a
film it did not make), and `reel-ingest`, `reel-runner`, `reel-reviewer`, `reel-auteur` for both paths. A skill reaches the engine
through `${CLAUDE_SKILL_DIR}`, an agent through `${CLAUDE_PLUGIN_ROOT}`.

The first film's plan and a few downscaled plate frames are the fixtures of record (`tests/fixtures/first-film/`); the engine's
tests for `reel plan`, `reel assemble`, `reel plate` and the cut and chapter rules read them. The example project uses neutral
names, and no code or skill text names an outside project, person or source. The library carries the plugin's version
(`reel_blender.__version__` equals `version` in `plugin.json`; a unit test checks it), so a session can tell whether the copy on
a Blender machine is the plugin's. `film.build_shot` refuses to empty an open scene that has unsaved changes and is not the
film's own (`film_state.check_open_file`).

## Generated sound

`audio/` turns a `FilmInfo` (scene starts, text settle times) and the spec's `meta.sound` and scene `cues` into stereo
samples at 48 kHz. `cues.ts` plans the cue list, `compose.ts` mixes bed, cues, echo and reverb and applies the fades and the
soft limiter, and `video/soundtrack.ts` scales the result to -14 LUFS with the same measurement the audio gate uses and
writes `sound.wav` and `sound.json`. The same plan always gives the same samples: every random choice comes from
`random.ts`, seeded by the spec. `commands/render/sound.ts` makes the track during `render` and `commands/render/join.ts`
muxes it in with `-c:v copy`. `meta.sound` and `cues` are left out of the segment cache key (`render/plan.ts`), so a sound
change redraws nothing.

## Output names

`core/outputs.ts` names every file a spec writes. `film.json` keeps `out/film.mp4`, `out/qa-report.json` and the other
short names; any other spec prefixes its own base name, so two specs in one folder never share a file or a cache. Commands
ask `outputsOf(spec.abs, spec.dir)`; none builds an `out/` path by hand.

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
