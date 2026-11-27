# Changelog

## 0.2.0 (unreleased)

- **Fixes from an independent review.** `reel assemble --shots` with shots left out follows the chosen shots in the sound
  curve; a plan with no shots, a shot id outside `[A-Za-z0-9_-]`, an intro or outro that shares a shot's id, an
  unreadable intro `tracks.json` and a bad `extra-cues.json` entry are errors that name the file and the field.
  `reel plan` warns about a `film_fps` that is not a multiple of `fps_poses` and a plate at another frame rate; `reel
  plan` and `reel assemble` find plates the same way (`--root`). `reel plate` reads a folder with `%` in its name and
  reports a black run at the first or last frames (a dim run or a lamp switched off is not reported). `reel cuts` reads
  only the frames around each cut and tells a file with no audio from an ffmpeg failure. The Blender library honours a
  shot's `plate` folder, reads every text file as UTF-8, `checks.match` no longer divides by zero, and `film.py` is split
  into `plan`, `film_state`, `film_camera`, `film_shot` and `film_queue` with the same public calls.

- **Films made in Blender are the main path.** Three new skills: `film` (intake, six or more look pitches, one real sample
  shot before the rest, a shot plan, animation by sequence, assembly, gates, an independent critic, one fix pass, a
  hand-over that says what nobody saw or heard), `studio` (the owner's profile and look ledger, in his own words) and
  `publish` (title, description with chapters, tags, thumbnail, upload settings, formats per platform, channel art; it
  never uploads). Nine skills now.
- **Two new agents, two changed.** `reel-animator` (Opus) builds one sequence in Blender; `reel-critic` (Opus) reviews a
  film it did not make. `reel-director` writes pitches, treatment and shot plan from the profile and ledger;
  `reel-builder` assembles from the plan. Eight agents now.
- **Blender library 0.3.0.** New modules `film` (plan-driven build, preview strip, check job, final render, tracks,
  status, a second format), `lettering` (hand and printed text as image textures), `stills` (stills, circle check sheet,
  banner crops, watermark cut) and `checks` (edge energy, brightness, match of two frames).
- **An example film project.** `blender/examples/paper_desk/`: one look module, one shot module and a three-shot plan with
  two formats. It shows structure, not a house style, and its plan passes `reel plan`.
- **The plan documents both sides.** `references/shot-plan.md` lists the fields the engine reads and the fields the
  Blender library reads, and says that `reel assemble` uses the sound palette `calm` unless the plan sets
  `sound.engine_palette`.
- **`reel plate` on a partial plate** (a three-pose check) names how many frame files are present and the missing ranges.
- **Shot plan and `reel plan`.** One file plans a film made of rendered plates: poses, plate location, tracks, labels
  with text, sub, line and timing, events, cues, formats, sound curve. `reel plan` checks the schema, totals, reading
  time per label, labels on screen at once, cue kinds and missing plates (a warning), and exits 1 on a failure. Fields the
  engine does not read stay as written, for the 3D side. See `references/shot-plan.md`.
- **`reel assemble`.** Writes the film spec from a plan, the plates and the files beside the plan
  (`label-overrides.json`, `extra-cues.json`, `outro-texts.json`, `brand.json`): `--shots`, `--format 9:16` (plates in
  `plates/<shot>@9x16`), `--intro`, `--outro`, `--no-sound`. A shot's `chapter` is copied to its scene.
- **`reel plate` checks brightness.** Lists runs of frames that are much darker or lighter than the frames before and
  after them, in the whole frame or the lower third, and exits 1: a render that lost its foreground.
- **`reel cuts` and the `cuts` gate.** For each cut, the mean brightness before and after and the rise in momentary
  loudness. The gate only warns; it never fails a film.
- **`reel chapters`.** Chapters from scene starts: the first at 0:00, each at least 10 s, a title is the
  `chapter` of the chapter's first scene that has one, else the label texts of its scenes (about 60 characters), else the
  film title or "Part N". Only the timestamp lines go to stdout. A scene may carry `chapter` in the spec; it changes no pixel.
- **Fix: leader lines of plate scenes no longer leak between scenes.** A leader line of a scene that was off screen
  showed through and failed the determinism gate on films with two or more plate scenes with leader labels.
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
- **Labels glide.** `smooth` (default 0.6 s) low-passes the path of a label box and `follow` (`both`, `x`, `none`) limits it, so labels on hopping points stay readable while the leader line and dot stay on the exact point.
- **Known limit.** `reel build` refuses a film with a plate scene: a plate is a folder of many files.
- **Generated sound.** `meta.sound` (`true`, or `{ palette, bed, cues, volume, seed, key, tempo, intensity }`) adds a
  quiet bed and cues timed to the picture, computed by a pure-TypeScript synthesiser in `scripts/audio/` (no samples,
  no packages, byte-identical for the same spec). Six palettes: `calm`, `bright`, `tense`, `minimal`, `epic`,
  `storybook`. Cues come from the film (a whoosh at each scene change, a tick where a text block settles, a chime at the
  last scene) and from a scene's own `cues` list (`tick`, `pop`, `whoosh`, `rise`, `chime`, `hit`, `boom`, `sting`),
  including on a `plate` scene, which used to ignore the field. The finished track is -14 LUFS; its true peak is at or
  below -1.5 dBTP in the WAV and at or below -1 dBTP in the MP4, after AAC.
- **Sound: `meta.sound.auto`.** Turns the cues derived from the picture down or off by kind: `false` for none, or
  `{ transition, text, ending }` with `true`, `false` or a gain multiplier from 0 to 1. A scene's own `cues` always play.
  Absent means as before.
- **Command: `reel sound`.** Writes `out/sound.wav` and the cue list `out/sound.json`; prints length, cue count,
  loudness and true peak.
- **Sound in render and export.** `reel render` muxes the track into the finished file with the video copied and AAC
  audio; `--no-sound` renders silent. Changing only `meta.sound` or a scene's `cues` re-mixes without redrawing a
  scene. `reel export` keeps the film's own sound, an explicit `--audio` file wins, a GIF has none.
- **Audio gate.** It now fails when `meta.sound` is on and the file has no audio track, and when audio and video differ
  by more than 0.1 s. Sound off stays skipped.
- **Output names follow the spec file.** `reel render film-desk.json` writes `out/film-desk.mp4`,
  `out/film-desk.qa-report.json` and so on, with its own scene cache, so two specs in one folder no longer overwrite
  each other. `film.json` keeps every name it had. `qa`, `export`, `stills`, `sound` and `build` follow the same rule.
  The scene cache key changed, so the first render after the upgrade draws every scene once.

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
