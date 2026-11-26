# Changelog

## 0.2.0 (unreleased)

- **Scene type: `plate` (13 built-in types now).** Plays an image sequence rendered elsewhere, for example in
  Blender, as the picture, and draws labels over it that follow points exported per frame: placed by side and
  offset, with a leader line, kept inside the safe area, hidden while the point is not visible, timed in seconds or
  from a named event of the plate. Free `texts` can sit at fixed places. The plate frame comes from the scene time and
  the plate's own rate, so a plate and a film may run at different rates. The data contract is `tracks.json`
  version 1; see `film-spec.md`.
- **Command: `reel plate <tracks.json>`.** Prints rate, frame count, size, length, the tracks with the share of
  frames each is visible, and the events; verifies every frame file and the size of the first frame; exits 1 with
  the missing file named.
- **Decode before capture.** The page publishes `window.__settle()`, and every capture path (stills, render, and the
  gates that draw frames) awaits it after `renderAt`, so a frame image that is not decoded yet is never captured as
  blank. A film without plates pays nothing. The live preview preloads ahead and holds the previous frame while one
  loads.
- **Gates for plates.** Contrast of text over a plate is measured against the plate pixels under the text. The holds
  gate counts a tracked label as readable while it moves slower than 6% of the short side per second and warns when
  it is faster for most of its time. The load gate validates `tracks.json`, label tracks and the first and last frame
  files, and warns when the plate is shorter than its scene.
- **Render cache.** A plate scene's key follows `tracks.json` and the size and modification time of each frame file,
  so editing a plate re-renders its scene and not the others.
- **Engine API.** `ctx.motion(el, profile)` records the speed of text that follows a picture;
  `FilmInfo.warnings` carries load warnings; `registerPreload` lets a scene type load files before it is built.
- **Known limit.** `reel build` refuses a film with a plate scene: a plate is a folder of many files.

## 0.1.0

First release of the plugin.

- **Engine.** A TypeScript CLI, `reel`, that Node 24 runs without a build step. It has nine commands: `doctor`,
  `init`, `scenes`, `preview`, `stills`, `render`, `qa`, `export` and `build`. Chrome and ffmpeg do the drawing
  and encoding; the plugin has no package dependencies.
- **Skills (6).** `video` (the pipeline), `release-video`, `metrics-video`, `explainer-video`, `check-film` and
  `add-scene`.
- **Agents (6).** `reel-ingest` and `reel-runner` on Haiku, `reel-builder` on Sonnet, `reel-director` and
  `reel-reviewer` on Opus, `reel-auteur` on Fable.
- **Scene types (12).** `title`, `bullets`, `changelog`, `metric`, `bar-chart`, `line-chart`, `compare`, `code`,
  `flow`, `image`, `quote` and `outro`. Each re-lays itself out at 16:9, 1:1 and 9:16.
- **Project scenes.** `.js` or `.ts` files that call `Reel.scene`, listed in `customScenes`.
- **Templates (4).** `release`, `metrics`, `explainer` and `blank`, created with `reel init`.
- **Quality gates.** Load, determinism, layout, reading holds, pacing, file properties, motion and audio, run by
  `reel qa`. `--page-only` runs the page gates in seconds without a render; `--size WxH` checks another format.
  A scene with a missing or misspelt field, a scene that throws, and text that reads `NaN` all fail.
- **Safe to stop.** A stop signal ends the browser, the encoder and the local server and removes temporary
  files. The server answers only local requests and does not serve hidden files or links out of the project.
- **Export presets (8).** `master`, `x`, `linkedin`, `youtube`, `slack`, `web`, `gif` and `webm`, with optional
  audio normalised to -14 LUFS and a poster frame.
- **Single-file build.** `reel build` bundles a film into one HTML file that plays in a browser.
- **Fonts.** Inter and JetBrains Mono, bundled under the SIL Open Font License.
