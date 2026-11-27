# Known issues and how they were solved

Shared knowledge for contributors and agents. Before debugging a rendering or QA problem, look here. When you
solve a new one, add it: symptom, cause, fix, and how to tell it is fixed.

## Rendering

### A second browser tab never returns a screenshot

- **Symptom:** a render with two workers hangs after the first scenes.
- **Cause:** headless Chrome paints only the foreground tab. A screenshot of a background tab waits forever.
- **Fix:** one browser process per render worker. `openFilm` gives every page its own browser.
- **Check:** `reel render` of a three-scene film finishes with two workers.

### The same frame differs by a few pixels between runs

- **Symptom:** an exact-hash comparison of two screenshots of the same time fails; 6 to 20 pixels differ by up
  to 4 levels, at rounded corners.
- **Cause:** Chrome's anti-aliasing depends on which part of a tile it repainted.
- **Fix:** the determinism gate compares pixels with a tolerance: it fails only when more than 40 pixels differ
  by more than 8 levels. A real dependence on history changes thousands of pixels.
- **Do not** try to fix this with `will-change`; it made rasterisation more history-dependent, not less.

### Leader lines of an off-screen plate scene show through, and the determinism gate fails

- **Symptom:** a film with two or more `plate` scenes whose labels have leader lines fails the determinism gate:
  about 130 pixels differ by up to 28 levels (more on longer films). The rendered video is right.
- **Cause:** the leader `<line>` carried `visibility="visible"`. A scene that is off screen is not redrawn, so its
  line kept the geometry and group opacity of its last draw, and the explicit `visible` overrode the `hidden` that
  the scene layer sets, painting a faint stale line over the scene that was on screen.
- **Fix:** the line uses `visibility="inherit"` (or `hidden` when it has no end), so the layer decides.
- **Check:** `reel qa film.json --page-only` passes determinism on a film with two plate scenes; the e2e test
  "two plate scenes with leader labels pass the determinism gate" covers it.
- **Rule:** inside a scene never set `visibility: visible` on a child; hide with the layer and let children
  inherit.

### An image looks one pixel different after other scenes were drawn

- **Symptom:** the determinism gate fails on a scene with a logo; about 500 pixels differ around the image.
- **Cause:** Chrome caches scaled bitmaps of `<img>` and `<canvas>`. A frame drawn at scale 1 can reuse a bitmap
  that was first drawn at a smaller scale.
- **Fix:** never animate the scale of an `<img>` or `<canvas>`. Logos fade and move. The image scene paints the
  picture as a CSS `background-image`, which Chrome repaints exactly, and keeps a hidden `<img>` only to learn
  the natural size.
- **Check:** draw a time, draw other times, draw the first time again; the screenshots match.

### Colours in the MP4 are slightly off

- **Symptom:** white reads as (251, 253, 250); dark backgrounds come out darker than the brand colour.
- **Cause:** converting full-range JPEG screenshots to limited-range BT.709 without accurate rounding.
- **Fix:** the encoder's scale filter sets `in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv`
  with `flags=accurate_rnd+full_chroma_int`, and the stream is tagged BT.709. Colours then land within 2 levels.
- **Check:** encode patches of known colours, decode one frame, compare.

### A plate frame is blank in the capture

- **Symptom:** a `plate` scene shows the background and the labels but no picture in a still or a rendered frame.
  It happens with large frames (a 3840x2160 plate did it in every try) and is rare with small ones, so a small test
  plate hides it.
- **Cause:** `renderAt(t)` is synchronous, but a frame image that has not been fetched and decoded yet paints nothing.
  The screenshot is a race against the load.
- **Fix:** the page publishes `window.__settle()`. A scene that loads pictures registers a settler (`runtime/settle.ts`);
  the plate scene's frame store reports the wanted frame as pending until it is decoded, and rejects with the file name
  when it is missing. Node awaits it through `drawAt` in `browser/film.ts` after every `renderAt`: `frameAt`, the render
  segments, and the determinism, layout and load-draw checks. A film without plates resolves it in the same turn.
- **Also:** the store paints a blob address that it owns, so the CSS background never makes a second request that
  could finish after the capture. It keeps 24 decoded frames and loads 6 ahead, so a plate of thousands of frames does
  not exhaust memory. The live preview does not wait: it keeps the previous frame until the next one is decoded.
- **Do not** call `window.renderAt` from new Node code; call `drawAt`. A path that skips the wait captures blanks only
  on a slow disk or a big plate, which is when it is hardest to notice.
- **Check:** `tests/e2e/plate.test.ts` renders a plate and compares frames with the plate files.

### Labels on hopping characters fail reading time

- **Symptom:** `reel qa --page-only` fails holds with "moves faster than 6% of the short side per second for 100% of its
  time on screen" and "readable (slow enough) for 0 s" for labels that follow characters that hop.
- **Cause:** the label box was glued to the exported point, so it bobbed with every hop. The gate measures the box, and a
  bobbing box is fast even when the character goes nowhere.
- **Fix:** labels have `smooth` (seconds, default 0.6) and `follow` (`both`, `x`, `none`). The box follows a zero-phase
  low-passed copy of the track, computed once at mount, while the dot and the leader end stay on the exact point.
  `follow: "x"` keeps one height clear of the point's highest moment. The gate reports the speed of the box after
  smoothing and clamping. In the 3D scene, put track empties above the highest point of the motion (`blender.md`).
- **Check:** `tests/unit/plate-smooth.test.ts` and the bobbing-track scenario in `tests/e2e/plate.test.ts`.

### Editing one plate re-rendered the whole film

- **Cause:** `projectStamp` hashes every file the spec names, and the render cache key of every scene contains it.
- **Fix:** plate scenes are left out of `projectStamp`. Each plate has its own fingerprint (`core/plate-stamp.ts`:
  `tracks.json` plus the size and modification time of every frame file, never the frame bytes). It goes into the key
  of the plate's scene and of the scene after it, which shows the end of the plate during the transition. Keep plates in
  a `plates/` folder: a plate inside `assets/` is hashed by the folder rule and invalidates every scene again.

### Rendering a second spec overwrote the first film's files

- **Symptom:** `reel render film-desk.json` wrote `out/film.mp4`, replacing the render of `film.json` in the same
  folder, and `qa`, `stills`, `export` and the segment cache were shared the same way.
- **Cause:** every command built its output names from the fixed word `film`, not from the spec's file name.
- **Fix:** `core/outputs.ts` is the one place that names outputs. `film.json` keeps the short names; any other spec
  prefixes its base name (`film-desk.mp4`, `film-desk.qa-report.json`, `film-desk.stills/`, `.film-desk.segments/`).
  A command that needs a file asks `outputsOf(spec.abs, spec.dir)`. Do not write `join(dir, 'out', 'film...')` in a command.
- **Check:** `tests/unit/outputs.test.ts` and the two-specs scenario in `tests/e2e/sound.test.ts`.

### Generated sound: what to know before changing it

- **Where:** `scripts/audio/` (synthesis), `video/soundtrack.ts` (loudness fit and files), `commands/render/sound.ts`.
- **Slow copies:** `Float32Array.from(a, fn)` runs a closure per sample and took 1.8 s for a 90 s track. Use a plain
  `for` loop in anything that touches every sample.
- **Reverb on a pad:** a comb reverb that gets the low notes of a pad makes one channel several dB louder than the other,
  chord by chord. The reverb send is high-passed at 300 Hz and only half of the tail's left-right difference is kept.
- **Cues against the bed:** the bed alone at -14 LUFS leaves cues at about +1 dB over it, and the cue windows of a
  measurement should sit a few dB above the bed windows. The cue bus is raised against the bed; the limiter keeps every
  cue under -2 dBFS and the loudness fit keeps the true peak at or below -1.5 dBTP, also after AAC.
- **What cannot be checked by a program:** whether it sounds good. Tests measure level, peak, timing, balance and
  determinism; a person has to listen once.

### The frame count is one off

- **Symptom:** the probe gate reports 289 frames expected, 290 found.
- **Cause:** `duration * fps` landed on a half frame and two places rounded it differently.
- **Fix:** the runtime rounds the duration to milliseconds before computing frames, and the renderer uses the
  runtime's frame count instead of computing its own.

### Chrome tries to reach the network

- **Symptom:** proxy errors for Google hosts while rendering.
- **Fix:** launch flags turn off background networking, component updates, sync and pings.

## Scenes and layout

### A transition shows two scenes' text on top of each other

- **Symptom:** the motion gate warns about an abrupt change just after a scene boundary.
- **Cause:** the outgoing scene held full opacity and then dropped in two frames while the incoming scene was
  already visible.
- **Fix:** fade-through: the outgoing scene fades over the first half of the overlap, the incoming scene over
  the second half, both on an ease-in-out curve.

### Tiles collapse in portrait

- **Symptom:** metric tiles overlap at 1080x1920.
- **Cause:** `flex: 1 1 0` in a column gives each tile a zero basis.
- **Fix:** use the growing flex rule only in a row. The layout gate catches this class of problem.

### Three metric tiles run past a square frame

- **Symptom:** the layout gate fails the `metric` scene at 1080x1080: the first label and the last chip are
  about 10 px outside the safe area.
- **Cause:** three stacked tiles at full size are taller than a square frame.
- **Fix:** stacked tiles share one size multiplier (`--rw-tile-k`). The scene lowers it in steps until the
  content fits. Landscape rows are not changed.
- **Check:** the template scenario runs every template at 16:9, 1:1, 4:5 and 9:16.

### Hyphens in prose look too wide

- **Symptom:** "error-rate" is drawn with a gap on both sides of the hyphen.
- **Cause:** tabular figures were set on the whole stage. In Inter that feature also swaps in a wider hyphen.
- **Fix:** only numbers that count carry the `rw-num` class. Prose uses proportional figures.

### A code line is smaller than the layout gate allows

- **Cause:** the code scene fitted long lines down to 2.4u, under the 2.6% minimum of the gate.
- **Fix:** the floor is 2.7u. A line that is still too long wraps.

### Typed text was never checked for reading time

- **Symptom:** a typed code scene passes the holds gate although typing ends after the scene.
- **Cause:** the gate knew only about tracks; typing ran in a per-frame function.
- **Fix:** `ctx.settle(el, seconds)` records when a per-frame reveal is complete. Typing always ends before the
  scene's fade, and each line reports its settle time.

### Text is flagged as clipped when it is not

- **Cause:** a heading with tight leading has a scroll height a few pixels over its box.
- **Fix:** `clipped` allows a vertical overshoot of 0.3 of the font size.

## Quality gate

### A text film is "frozen" most of the time

- **Cause:** text holds still while it is read; that is intended.
- **Fix:** the still-time limit for a scene is the larger of `meta.maxHold` and the scene's longest required
  reading hold plus 1.5 s. The frozen-ratio warning starts at 85%.

### A label that follows the picture was judged against "still"

- **Cause:** the holds gate measured seconds without motion, and a tracked label is never still.
- **Fix:** the scene records the label's speed at each plate frame with `ctx.motion`. The label counts as readable
  while it is fully shown and moves slower than `LABEL_MAX_SPEED`, and the gate warns when it is faster for most of its
  time. The speed is the label's own, after clamping to the safe area, so a label held at the edge reads as still.

### Text over a plate passed the contrast check against the wrong colour

- **Cause:** contrast used the computed CSS background, which is the brand colour under the picture.
- **Fix:** a scene can register a backdrop sampler (`runtime/backdrop.ts`). The plate scene samples the mean colour of
  the decoded frame under the text box; a label's own panel still wins, because it is nearer the text. The mean can
  hide a small bright area behind dark text; a `tag` label avoids the question.

### QA passed a film that showed "NaN"

- **Symptom:** a `metric` scene written with `metrics` instead of `items` drew "NaN" and every gate passed.
- **Cause:** scenes did not check their fields, and no gate read the text.
- **Fix:** each scene checks its required and numeric fields when it mounts; the error names the scene, the
  field and any unknown field as the likely typo, and the load gate fails. The layout gate also fails visible
  text that reads `NaN`, `undefined`, `null` or `[object Object]`.

### A scene that throws mid-film was reported by the wrong gate

- **Symptom:** a custom scene that threw at 4 s passed the load gate and crashed a later gate with a stack.
- **Fix:** the runtime guards each scene's frame code and records "scene N (type) threw at t=...". The load gate
  draws every scene at three times and fails with that message. `render` stops with the same line and no stack.

### QA said PASS with no render

- **Fix:** without a video the verdict is `INCOMPLETE` and the exit code is 1. `--page-only` asks for the page
  gates alone. A render older than the spec fails the probe gate.

### The first frame is empty

- **Cause:** every entrance starts from nothing, so frame 0 was the bare background.
- **Fix:** `meta.lead` (0.5 s) skips the start of the first entrance. Export with `--poster auto` for thumbnails.

### A stopped render left Chrome and ffmpeg running

- **Symptom:** after a timeout or Ctrl+C, browser and encoder processes stayed alive and temporary files stayed
  on disk.
- **Fix:** every browser, encoder and server registers with `core/cleanup.ts`. A stop signal runs them all and
  exits with 128 plus the signal number. Chrome is started in its own process group and killed as a group, and
  its temporary folder is inside the profile folder that is removed on close.
- **Check:** the lifecycle scenarios in `tests/e2e`.

## Runtime platform

### The engine uses a Node API that is still marked experimental

- **What:** the local server turns the browser runtime's `.ts` files into JavaScript with
  `module.stripTypeScriptTypes`. Node 24 prints an experimental warning for it; the engine filters that one
  warning out.
- **Why it is used:** it is the only way to serve TypeScript to the browser with no build step and no package
  dependency. Running `.ts` files in Node itself is stable and does not depend on it.
- **Risk:** a later Node release can rename or change the function. `reel doctor` checks it ("type stripping")
  and says so before any render is tried.
- **If it breaks:** `server/transpile.ts` is the only file that calls it.

## Packaging

### The plugin does not install in the Claude app

- **Cause:** a top-level `bin/` folder, or skill frontmatter fields other than `name` and `description`.
- **Fix:** scripts live inside the `video` skill; frontmatter stays minimal.

### A skill cannot find the engine in chat

- **Cause:** chat copies only the skill's own folder into its sandbox.
- **Fix:** the engine lives in `skills/video/`. The other skills refer to it as a sibling folder and, when it is
  not there, say to load the `video` skill and use the path it gives.
