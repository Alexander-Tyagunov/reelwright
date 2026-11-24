# Changelog

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
- **Quality gates.** Determinism, layout, reading holds, pacing, file properties, motion and audio, run by
  `reel qa`. `--page-only` runs the page gates in seconds without a render.
- **Export presets (8).** `master`, `x`, `linkedin`, `youtube`, `slack`, `web`, `gif` and `webm`, with optional
  audio normalised to -14 LUFS and a poster frame.
- **Single-file build.** `reel build` bundles a film into one HTML file that plays in a browser.
- **Fonts.** Inter and JetBrains Mono, bundled under the SIL Open Font License.
