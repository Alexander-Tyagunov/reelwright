# The film pipeline, step by step

Each step names what to read, what to run or call, what it writes, and the evidence that it is done. Paths:
`reel` is the engine CLI (`node ${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts` from a skill,
`node ${CLAUDE_PLUGIN_ROOT}/skills/video/scripts/reel.ts` from an agent); `video/` is the video skill's
`references/` folder; `film/` is the film skill's `references/` folder.

## The film folder

Use the folder the owner names. Otherwise make `films/<slug>/` under the current working directory; the studio
files then live in `films/studio/` (the `studio` skill).

```text
films/
  studio/PROFILE.md, studio/ledger.json     the owner's taste and past looks
  <slug>/
    brief.md                 step 1
    content.json             step 2: every fact, with its source
    data/REVIEW.md           step 2: conflicts, choices made, what is unsure
    treatment.md             step 3 (film/treatment-template.md)
    plan/shots.json           step 5: the shot plan (format: video/shot-plan.md)
    plan/film-plan.md        step 5: the same plan in prose, for animators
    plan/HANDOVER.md         step 6: one section per sequence (film/handover-template.md)
    plan/label-overrides.json, extra-cues.json, outro-texts.json, brand.json   optional, read by reel assemble
    blender/                 the film's Python: one look module, one module per sequence
    plates/<shot>/           frames/0001.jpg ... and tracks.json; plates/<shot>@9x16/ for a second format
    renders/preview/, renders/check/<shot>/, blends/, render_queue/   written by reel_blender.film
    film.json                written by reel assemble; never edited by hand
    out/                     renders, reports, exports
    review/                  sample stills, critic sheets, REVIEW.md
    publish/                 the publishing kit (publish skill)
```

On one machine this folder is also the project folder given to `film.register`, so Blender writes `plates/`,
`renders/`, `blends/` and `render_queue/` into it directly. In the two-machine layout the Blender machine has a
project folder of its own (`video/blender.md`, section 2) with `scripts/` (a copy of `blender/`), `plan/`, `renders/`,
`plates/`, `blends/` and `render_queue/`. The workspace copy is the source of truth for code and plan; the Blender
machine is the source of truth for renders until they are brought across.

## 1. Intake

Write `brief.md`:

```text
Premise       one sentence: what happens, to whom
Source        files or links the facts come from
Audience      who watches, where, on what screen
Length        seconds (30 to 90 is the range this pipeline was built on)
Formats       16:9 1920x1080; add 9:16 1080x1920 or 1:1 1080x1080 only if asked or the profile lists it
Sound         generated bed and cues (default), silent, or the owner's own track
Direction     the owner's words about look, tone or references, quoted; "none given" if none
Series        new world, or the next film in an existing one (name the ledger entry)
Profile       what was taken from studio/PROFILE.md, one line per item
Assumptions   everything you decided instead of asking
```

At most one question, and only for a missing premise or source. Done when every line is filled.

## 2. Facts

Every name, number and date that can appear on screen goes into `content.json` with its source (the format
`reel-ingest` writes; hand a long changelog, data file or document to it). Check each fact against a primary
source (the maker's own page or data), not a summary. Write `data/REVIEW.md`: conflicts between sources and which
one you chose and why, rows you could not verify, and what you left out. Done when nothing on the plan's label
list lacks a source. Facts come before any picture: the story is built on them, and a wrong date found after the
render costs a re-render.

## 3. Treatment

Hand to `reel-director` with `brief.md`, `content.json`, `studio/PROFILE.md`, `studio/ledger.json` and
`film/treatment-template.md`. Check the result yourself before you go on:
- six or more pitches, differing in medium; the pick argued from premise, audience and the owner's words;
- the ledger comparison is written out (medium and palette family of the last five entries against the pick);
- the signature shot is described pose by pose, because it becomes the sample;
- a budget in tokens and render minutes;
- a table from each story beat to the fact it carries.

If a check fails, send the director the one missing item. Done when all five are present.

## 4. Sample shot

Follow `film/sample-first.md`. Done when the owner said yes and his words are in `treatment.md` under "Owner".

## 5. Shot plan

Hand to `reel-director` with the approved treatment, the sample's `plan/HANDOVER.md` section (its measured
seconds per pose and the look parameters), and `video/shot-plan.md`. It writes `plan/shots.json` and
`plan/film-plan.md`. Then run:

```bash
reel plan plan/shots.json
```

It checks the schema, totals, the reading time of every label and line against its shot, the label budget per
second, cue kinds, and warns about missing plates (expected now). Exit 0 is done; on exit 1 send the director the
printed lines. The sample shot keeps its place in the plan with its rendered plate.

Sequences: 3 to 4 shots each, at most three new mechanisms each (a thing that folds, a light behind paper),
roughly equal render time. The plan's pose total times the measured seconds per pose is the render budget; if it
is over the owner's cap, the director cuts shots, not reading time.

## 6. Animation by sequence

For each sequence in plan order, start one `reel-animator` with: the film folder, the sequence id and its shots,
`plan/shots.json`, `plan/film-plan.md`, `plan/HANDOVER.md`, the layout (one machine or two) and the Blender
machine's film folder. It reads `video/blender.md`, `video/handmade.md` when the look must read as made by hand,
and section 12 of `video/blender.md`: the `reel_blender.film` calls in order (`film.register` with the film's
`film.Look` and its shot builders, `build_shot`, `strip`, `submit_check`, `submit`, `export_tracks`, `status`).

In the two-machine layout every changed file in `blender/` and `plan/shots.json` is committed to the Blender
machine's project folder before Blender imports it; the animator does this, and so do you after a plan change.

It works shot by shot: build, live strip of 6 poses, fix, three-pose check job at final settings through the
queue, look at the check frames at 100%, then the final job. It appends its section to `plan/HANDOVER.md` and
corrections to the references it found wrong, and replies with the shots queued, measured seconds per pose,
deviations from the plan, and what the next animator must know.

Done for a sequence when every shot has a final job in the queue and the handover section exists. Start the next
animator then; do not wait for the renders.

Intro and outro: when the plan or the profile has them, build them after the last sequence. An intro is a short
shot on the first shot's set and camera, registered as an extra shot (`film.register(..., extra_shots=)`), so the
cut into it is invisible; prove the cut with `reel_blender.checks.match` in the workspace (shift, brightness and
edge ratio of the intro's last frame against the first shot's first frame). An outro can
be a hold built from the last shot's static poses with end text composited by the engine (`outro-texts.json`).

## 7. Render queue

Before every submission check free space on the Blender machine with `film.disk_free_mb()` through the Blender
tool. A 1080p frame is about 0.5 MB plus a raw image while it renders, so a 90-second film at 12 poses a second
needs about 0.6 GB of plates per format. `submit` and `submit_check` refuse below 500 MB; tell the owner before
that, when free space is under twice what the queued shots need. A job whose disk filled up once reported an
ordinary exit while its progress file stayed at "starting": read its `render.log`.

Poll every 5 to 15 minutes with `film.status()` through the Blender tool (it renders nothing and returns at once;
it lists every job, when the queue empties, and `free_mb`). A job is finished when its state is `done`, not when
its frame count is one short. Then:
- one machine: the plate is already in `plates/<shot>/`;
- two machines: pack it on the Blender machine, stage it, unpack it into `plates/<shot>/` (`video/blender.md`,
  section 7, "Transfer").

```bash
reel plate plates/<shot>/tracks.json
```

Exit 0 means tracks, events, every frame file and the frame size agree, and no frame's brightness (whole frame or
lower third) jumps out of the range of both neighbours. On exit 1 for brightness, the listed frames go back to the
animator as a re-render of those poses; a render-run fault once blacked out 12 frames of an otherwise correct shot.
Done when every shot of the plan has a plate that passes.

## 8. Assembly

Hand to `reel-builder` with the film folder. It runs, from the film folder:

```bash
reel assemble plan/shots.json --out film.json                  # add --intro plates/A0 --outro plates/Z0 if built
reel stills film.json --at <the most label-heavy moment of each shot>
reel qa film.json --page-only
```

For a partial film while plates are still rendering, `--shots A1,A2,A3`. For a second format,
`--format 9:16 --out film-9x16.json` (needs `plates/<shot>@9x16/`). Label position, timing and sound fixes go into
`plan/label-overrides.json` and `plan/extra-cues.json`; then assemble again. Words are never changed in an
override; a wording change is a plan change and goes back through `reel plan`. Done when `--page-only` passes.

## 9. Render and gates

```bash
reel render film.json
reel qa film.json
reel cuts film.json
```

`reel qa` must show no FAIL. `reel cuts` lists each cut with mean brightness before and after and the jump in
momentary loudness; it is also a warning-only gate inside `reel qa`. A flagged cut is not a failure, but someone
must look at the two frames side by side: the builder saves them as one image in `review/` and the critic judges
them. Done when the gate table and the cut report are in the builder's reply.

## 10. Critic

Hand to `reel-critic` with the film folder and `film/critic-rubric.md`. It writes `review/REVIEW.md`. Done when
the file has a verdict, every finding has a class and a time, and a "Not checked" section.

## 11. One fix pass

Sort the findings: every spec fix goes to `reel-builder` in one message; each re-render goes to `reel-animator`
with the shot, the poses and the cause to find first. Leave the rest, and carry them into the hand-over. After the
fixes, steps 8 and 9 again, then `reel-critic` once more on the changed shots only. Done when the second review has
no finding above "leave".

## 12. Delivery

```bash
reel export film.json --preset master
reel export film.json --preset youtube --poster auto
ffmpeg -i out/film.mp4 -vf scale=1280:-2 -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart out/film-720p.mp4
```

The viewing copy matters: per-pixel grain makes large files, and chat file sharing stops at 400 MB. Report the
paths, duration, file sizes, the final gate table, and the hand-over (SKILL.md, step 12). Then offer the ledger
entry and the publishing kit.

## What each step costs (first film, rounded)

| Step | Tokens | Other |
|---|---|---|
| Facts | 100k to 200k with source checking | |
| Treatment and plan | about 350k | |
| Sample shot | 300k to 400k | one shot's render, 30 to 40 minutes |
| Each sequence of 3 to 4 shots | 350k to 420k | 18 s a pose, 12 poses a second |
| Intro shot | about 230k | |
| Each assembly pass | 130k to 240k | the render of a 90 s film took about 3 minutes |
| Review | about 180k | |
| Channel art (publish skill) | about 300k | |

The facts figure is an estimate; the others were measured.
