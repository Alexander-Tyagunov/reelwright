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

### QA said PASS with no render

- **Fix:** without a video the verdict is `INCOMPLETE` and the exit code is 1. `--page-only` asks for the page
  gates alone. A render older than the spec fails the probe gate.

### The first frame is empty

- **Cause:** every entrance starts from nothing, so frame 0 was the bare background.
- **Fix:** `meta.lead` (0.5 s) skips the start of the first entrance. Export with `--poster auto` for thumbnails.

## Packaging

### The plugin does not install in the Claude app

- **Cause:** a top-level `bin/` folder, or skill frontmatter fields other than `name` and `description`.
- **Fix:** scripts live inside the `video` skill; frontmatter stays minimal.

### A skill cannot find the engine in chat

- **Cause:** chat copies only the skill's own folder into its sandbox.
- **Fix:** the engine lives in `skills/video/`; other skills refer to it as a sibling folder.
