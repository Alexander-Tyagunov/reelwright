# The QA gates

`reel qa film.json` measures a film and exits 1 if any gate fails. It writes `out/qa-report.json` (add `--json` to
print it); a spec not called `film.json` uses its own name (`film-desk.json` gives `out/film-desk.mp4` and
`out/film-desk.qa-report.json`). Run it after `reel render`: without a render the three video gates cannot run and the verdict is
INCOMPLETE (exit code 1; run render, then qa again). `--page-only` runs only load, determinism, layout, holds and
pacing in seconds, without a render, and gives pass, warn or fail on those; render and run qa again for the video
gates. `--size WxH` checks another format and writes `out/qa-report-WxH.json`. `--strict` also fails on warnings. With a spec and `--video file.mp4` the report is named after the video (`out/qa-report-<name>.json`), so the main report is not replaced. A draft render is not checked: render in full, or pass the draft with `--video`. For a video made with any other tool, `reel qa --video file.mp4`
runs the gates that need only the file (properties, motion, loudness).

A gate that has nothing to measure says so: `layout` and `holds` show SKIP and "no text to measure" for a film with no
text, and `cuts` shows SKIP for a film of one shot. A pass on zero items is not a measurement, so name those gates in a
hand-over instead of pasting "PASS".

A gate reports numbers and names the scene, so a fix can be made without guessing. Fix one failure at a time with
the smallest change, re-render (unchanged scenes are reused) and run it again.

| Gate | What it measures | Fails when | Usual fix |
|---|---|---|---|
| `load` | The page opens, and every scene draws at its start, its settled moment and its last frame, without errors. | Any page error; a spec or custom scene that does not load; a scene field that is missing or not a number where one is needed; a scene that throws while a frame is drawn. Warns on a font that is not available, and on a plate shorter than its scene. A plate scene also fails when `tracks.json` is invalid, a label names a track the plate lacks, or the first or last frame file is missing. | Read the message: it names the scene number, its type and the field or the time. An unknown field is listed as the likely typo. |
| `determinism` | Up to 6 frames, each drawn cold on a fresh page and again after the two frames before it, plus one frame redrawn after all the others. | More than 40 pixels differ by more than 8 levels. (Chrome's anti-aliasing can move a handful of pixels by a few levels; that is ignored.) | A custom scene uses a clock, `Math.random()`, or state kept between frames. Make every value a function of `t`. Do not animate the scale of an `<img>` or `<canvas>`. |
| `layout` | Every visible text box at each scene's `check` time and just after each text settles (at most 6 samples per scene), so a label that shows only mid-scene is measured too. | Text more than 1 px outside the safe area; text clipped by its box; two unrelated text boxes overlapping by more than 4%; contrast below 3:1; visible text that reads `NaN`, `undefined`, `null` or `[object Object]` (a value that never arrived; `null` and `undefined` are allowed in a `code` scene). Warns on type under 2.6% of the short side and contrast under 4.5:1. | Shorten the copy first. Then fewer items, then a scene type with more room. For contrast use `--ink` or `--muted` on `--bg` or `--surface`. |
| `holds` | For each text block: seconds it stays still after landing, against 0.3 s per word + 0.5 s. A tracked label counts while it moves slower than 6% of the short side per second. | Hold under 70% of what is needed. Warns under 100%, and when a tracked label is fast for most of its time on screen. | Lengthen the scene by the reported amount, or cut words. |
| `pacing` | Scene lengths and the first and last frames. | Never fails. Warns on a scene under 1.5 s or over 12 s, and on a blank first or last frame (not for a film with `meta.loop`, where blank ends are the design). | Merge or split scenes. Export with `--poster auto` for a blank first frame. |
| `probe` | The MP4's codec, pixel format, size, frame rate and frame count against the spec, and that the video is not older than the spec. | Any mismatch. Also when the render summary next to the video (`out/render*.json`) was made from a different spec, runtime or project file set than the current one ("the video is older than the spec or runtime"). | Render again at the size being checked, or pass the matching `--video`. |
| `motion` | Frame-to-frame change across the whole video (160x90 grey, mean absolute difference). | A still stretch longer than the limit: `meta.maxHold` (4 s) or the scene's longest required reading hold + 1.5 s, whichever is larger. A scene with no motion in its first 1.5 s. A loop whose last frame does not flow into the first. Warns when over 85% of the film is still, and on a full-frame jump that is not at a scene boundary. | Shorten the scene or reveal its content in more steps. For a dead scene, check its spec fields against `reel scenes`. |
| `audio` | That the sound is in the file and as long as the picture; integrated loudness and true peak of the finished file. | `meta.sound` is on and the video has no audio track; audio longer or shorter than the video by more than 0.1 s. Otherwise it only warns: outside -16 to -12 LUFS or above -1 dBTP. Skipped when sound is off and there is no audio track. | Render again without `--no-sound`. For a soundtrack of your own, re-export with `--audio`; the export normalises to -14 LUFS. |
| `cuts` | At each cut between scenes: mean brightness of the last frame before and the first frame after, and the rise in momentary loudness (the highest in the second after, against the mean of the second before). With a fade the cut is the middle of it. | Never fails. Warns for a cut whose brightness changes by more than 50% of the brighter frame, or whose loudness rises by more than 6 LU, and names the cut. A video that cannot be read also only warns. Not run with `--page-only` | A warning is for a person to judge: a hard change of place is often the design. Fix a jump that is not: match the first frame of the next shot to the last of this one, or lower the cue or bed level at the cut. `reel cuts film.json` prints the same numbers for every cut |

## Plate scenes

A `plate` scene is checked by the same gates, with these differences.

- **Brightness of the frames.** `reel plate` (not `qa`) lists runs of up to 12 frames whose mean brightness, over the whole
  frame or its lower third, lies outside the range of the frame before and the frame after the run by more than 20% (and 4
  grey levels), when those two frames agree within 35%. It finds a render that lost its foreground and went black for a
  few poses. A steady fade, or a step to a new level such as a lamp switched off, is not listed. Exit code 1 when it lists
  a run; render those frames again.

- **Drawing.** Every gate that draws a frame waits until the plate frame is decoded before it captures, so a slow disk cannot
  produce a blank picture. A frame file that is missing in the middle of the plate fails the command with its name.
- **Layout and contrast.** CSS colours cannot see the picture, so for text over a plate the gate measures the mean colour of
  the plate pixels under the text box (taken from the decoded frame, without the labels) and uses it as the background. A
  `tag` label has its own panel, so its text is measured against the panel colour. A box that covers both bright and dark
  areas is judged against their average. Labels are kept inside the safe area, so a label near the frame edge is moved, not
  reported; overlapping labels are reported.
- **Holds.** A tracked label moves with the picture, so it is never still. It counts as readable while it is fully faded in
  and moves slower than `LABEL_MAX_SPEED` (6% of the short side per second); the gate uses the longest unbroken stretch
  against the usual 0.3 s per word + 0.5 s. A label hidden because its point is not visible breaks the stretch. The gate also
  warns when a label moves faster than the limit for more than half of its time on screen (`LABEL_FAST_SHARE`).
- **Determinism and motion.** Unchanged. A plate that holds its last frame by design is covered by the load warning, so the
  motion gate's frozen limits are not loosened.

## Reading the motion line

```
motion per 0.5 s (_ <0.03 frozen, . <0.1, : <0.3, - <1, = <3, + <10, # more)
     0s |-._____.=-:.____.+-.::::...+:_::.:._______--:_____|
```

Each character is half a second. Text films are still most of the time, because text holds while it is read;
that is expected. What should not happen is a run of `_` longer than the content justifies, or a scene that
starts with `_`.

## What the gates cannot tell you

They measure whether the film is correct, readable and alive. They do not measure whether it is good: whether
the emphasis lands, whether the rhythm feels right at full speed, whether the sound suits it. Stills and numbers
are not watching. A person presses play once before a film is published.

## Thresholds

All thresholds are constants in `scripts/qa/thresholds.ts`, each named with its unit, and each gate is one file in
`scripts/qa/gates/`. The seeded-defect films in `tests/e2e` of the source repository (a frozen scene, `Math.random()`, state across frames,
text off the frame, overlapping text, a hold too short, low contrast, a broken loop seam) check that each gate
catches its defect and that a clean film passes. When a threshold changes, change this page and its scenario in
the same commit.
