# The QA gates

`reel qa film.json` measures a film and exits 1 if any gate fails. It writes `out/qa-report.json` (add `--json` to
print it). Run it after `reel render`: without a render the three video gates cannot run and the verdict is
INCOMPLETE (exit code 1; run render, then qa again). `--page-only` runs only load, determinism, layout, holds and
pacing in seconds, without a render, and gives pass, warn or fail on those; render and run qa again for the video
gates. `--size WxH` checks another format and writes `out/qa-report-WxH.json`. `--strict` also fails on warnings. With a spec and `--video file.mp4` the report is named after the video (`out/qa-report-<name>.json`), so the main report is not replaced. A draft render is not checked: render in full, or pass the draft with `--video`. For a video made with any other tool, `reel qa --video file.mp4`
runs the gates that need only the file (properties, motion, loudness).

A gate reports numbers and names the scene, so a fix can be made without guessing. Fix one failure at a time with
the smallest change, re-render (unchanged scenes are reused) and run it again.

| Gate | What it measures | Fails when | Usual fix |
|---|---|---|---|
| `load` | The page opens, and every scene draws at its start, its settled moment and its last frame, without errors. | Any page error; a spec or custom scene that does not load; a scene field that is missing or not a number where one is needed; a scene that throws while a frame is drawn. Warns on a font that is not available. | Read the message: it names the scene number, its type and the field or the time. An unknown field is listed as the likely typo. |
| `determinism` | Up to 6 frames, each drawn cold on a fresh page and again after the two frames before it, plus one frame redrawn after all the others. | More than 40 pixels differ by more than 8 levels. (Chrome's anti-aliasing can move a handful of pixels by a few levels; that is ignored.) | A custom scene uses a clock, `Math.random()`, or state kept between frames. Make every value a function of `t`. Do not animate the scale of an `<img>` or `<canvas>`. |
| `layout` | Every visible text box at each scene's `check` time and just after each text settles (at most 6 samples per scene), so a label that shows only mid-scene is measured too. | Text more than 1 px outside the safe area; text clipped by its box; two unrelated text boxes overlapping by more than 4%; contrast below 3:1; visible text that reads `NaN`, `undefined`, `null` or `[object Object]` (a value that never arrived; `null` and `undefined` are allowed in a `code` scene). Warns on type under 2.6% of the short side and contrast under 4.5:1. | Shorten the copy first. Then fewer items, then a scene type with more room. For contrast use `--ink` or `--muted` on `--bg` or `--surface`. |
| `holds` | For each text block: seconds it stays still after landing, against 0.3 s per word + 0.5 s. | Hold under 70% of what is needed. Warns under 100%. | Lengthen the scene by the reported amount, or cut words. |
| `pacing` | Scene lengths and the first and last frames. | Never fails. Warns on a scene under 1.5 s or over 12 s, and on a blank first or last frame (not for a film with `meta.loop`, where blank ends are the design). | Merge or split scenes. Export with `--poster auto` for a blank first frame. |
| `probe` | The MP4's codec, pixel format, size, frame rate and frame count against the spec, and that the video is not older than the spec. | Any mismatch. Also when the render summary next to the video (`out/render*.json`) was made from a different spec, runtime or project file set than the current one ("the video is older than the spec or runtime"). | Render again at the size being checked, or pass the matching `--video`. |
| `motion` | Frame-to-frame change across the whole video (160x90 grey, mean absolute difference). | A still stretch longer than the limit: `meta.maxHold` (4 s) or the scene's longest required reading hold + 1.5 s, whichever is larger. A scene with no motion in its first 1.5 s. A loop whose last frame does not flow into the first. Warns when over 85% of the film is still, and on a full-frame jump that is not at a scene boundary. | Shorten the scene or reveal its content in more steps. For a dead scene, check its spec fields against `reel scenes`. |
| `audio` | Integrated loudness and true peak of the finished file. | Never fails. Warns outside -16 to -12 LUFS or above -1 dBTP. Skipped without an audio track. | Re-export with `--audio`; the export normalises to -14 LUFS. |

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
