---
name: film
description: Makes a finished short film in Blender, from a premise or source material to a checked MP4 and a hand-over, in a look developed for that film and steered by the owner's recorded taste. Use when the user says "make a film about", "turn these release notes into a short film", "a short animated film of our history", "make it look hand-made", "stop-motion", "a film in Blender", "not another slideshow", or asks for a video with a premise, characters or a made world rather than a templated clip. Reads the studio profile and look ledger, writes six or more look pitches, shows one real sample shot before building the rest, plans every shot, animates and renders in Blender, assembles, measures and has the film reviewed by an agent that did not make it. For a recurring, templated clip the video skill's scene library is the faster path.
---

# Make a film in Blender

A film here has a premise, original characters and a made world. Blender renders each shot as a plate (frames
plus `tracks.json`); the Reelwright engine adds words, sound and cuts, assembles the film and measures it. Your
job is to keep the chain moving, hand each step to the agent named below, and show the owner the two things he
judges by eye: one sample shot, then the finished film.

Names used below:
- `reel` is `node ${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts`.
- `film/` is `${CLAUDE_SKILL_DIR}/references/`, `video/` is `${CLAUDE_SKILL_DIR}/../video/references/`.
- The Blender library is `${CLAUDE_SKILL_DIR}/../video/blender/reel_blender/`; an example film project is
  `${CLAUDE_SKILL_DIR}/../video/blender/examples/paper_desk/`. Take its structure, and copy freely what is
  construction and not taste (the cutting-mat grid shader, `area`, `tape`, `knife` in `look.py` and `desk_set.py`; the
  mat grid leans on `paper._math` and `paper._put`, copy those too). Do not copy its palette, room or lamp colours.
- "The Blender tool" is the MCP tool that runs Python inside Blender. Its prefix differs between setups; its name
  ends in `execute_blender_code`. Find it with ToolSearch, query `execute_blender_code`.

`film/pipeline.md` has the detail of every step: the files, the exact commands, and the evidence that the step is
done. Read it once before step 1 and again at each step.

## Before step 1: what this setup can do

1. Run `reel doctor`. It must report Node 24, ffmpeg and a browser. In a cloud workspace install what is missing
   (Node 24 through npm); on the owner's own computer tell him what to install. If `node --version` is below 24, run
   `npm install --prefix <dir> node@24` (for example `~/tools/node24`), then start every `reel` command with
   `PATH=<dir>/node_modules/node/bin:$PATH`: shell state does not carry over between calls, so one export is not
   enough. Run `reel doctor` again; it prints the same advice.
2. Load the Blender tool and run the connection check in `video/blender.md`, section 1, adding
   `os.path.expanduser("~")` to what it returns. Then `ls` that path in your shell. `video/blender.md`, section 2,
   describes both layouts:
   - **One machine:** the path exists in your shell. Blender, the engine and your shell share one disk.
   - **Two machines:** it does not, and the bridge tools (`device_stage_files`, `device_commit_files`) are
     present. Your workspace is in the cloud, Blender is on the owner's computer, and files cross the bridge.
3. If there is no Blender tool, or it does not answer, say so in one message: a Blender film needs Blender 5.x
   running with its MCP server connected, and it is not reachable now. Offer two ways on: he connects it and you
   continue, or you make the film with the scene library (the `video` skill), which is drawn in code and
   looks like it. Steps 1 to 3 need no Blender and can go ahead while he decides. Do not draw code scenes and
   present them as a Blender film.
4. Read the studio profile and the ledger (`studio` skill, "Read"). If there is none, carry on without; the
   `studio` skill offers to start one at delivery.

## The steps

| # | Step | Who (model) | Done when |
|---|---|---|---|
| 1 | Intake | this session | `brief.md` is filled; at most one question was asked |
| 2 | Facts | this session; `reel-ingest` (Haiku) for a long source | `content.json` holds every fact with its source; `data/REVIEW.md` lists conflicts |
| 3 | Treatment | `reel-director` (Opus) | `treatment.md` follows `film/treatment-template.md`, six or more pitches, the ledger compared, a budget |
| 4 | Sample shot | `reel-animator` (Opus) | the owner has seen one finished shot and said yes; his words are in `treatment.md` |
| 5 | Shot plan | `reel-director` (Opus) | `reel plan plan/shots.json` exits 0 |
| 6 | Animation by sequence | `reel-animator` (Opus), one sequence at a time | each shot's check frames were looked at, its final job is queued, `plan/HANDOVER.md` has its section |
| 7 | Render queue | this session (it needs the Blender tool) | every plate is in `plates/<shot>/` and `reel plate` exits 0 for it |
| 8 | Assembly | `reel-builder` (Sonnet) | `reel assemble` wrote `film.json`; `reel qa film.json --page-only` passes |
| 9 | Render and gates | `reel-builder` (Sonnet) | `reel qa film.json` has no FAIL; the `reel cuts` report is read |
| 10 | Critic | `reel-critic` (Opus) | `review/REVIEW.md` has a verdict and every finding classed |
| 11 | One fix pass | `reel-builder` for spec fixes, `reel-animator` for re-renders | the chosen findings are fixed and steps 8 to 9 pass again |
| 12 | Delivery | this session | files exported, the hand-over sent, a ledger entry offered |

**An ident, or any film of one or two shots.** The sample is the whole film in its main format; labels, facts, chapters
and the cut report may be empty (`labels: []` in the plan is fine); build the second format only after the sample is
approved (`film/sample-first.md`).

Keep going until step 12 is done. A failed render, a gate failure or a slow queue is ordinary work, not a reason
to stop. The only planned stop is the owner's answer at step 4.

Start an agent with the Agent tool, naming it as the subagent type (`reel-director`). Where agents cannot run (chat
on claude.ai), do the agent's job yourself by following its file in `${CLAUDE_SKILL_DIR}/../../agents/`. The limits that
count agents (one agent drives Blender at a time, a token budget for each) then lose their meaning, and if the same session does the
critic's job the review was not independent: its first line and the hand-over say so, and the owner's own viewing is the only
outside check. Give
every agent the film folder, the files to read, the one output you want, and the limits: one render command
at a time, at most 3 fix rounds on the same failure, at most 2 review rounds. Only one agent drives the live
Blender at a time: two agents building in one Blender session overwrite each other's scene. The render queue
runs on its own, so the next animator can build while earlier shots render. Models and why:
`${CLAUDE_SKILL_DIR}/../video/references/model-routing.md`.

## Step 1: intake, with one question at most

Make the film folder (`film/pipeline.md`, "The film folder") and fill `brief.md` from step 1 there: premise,
source, audience and where it is watched, length, formats (16:9 only, or also 9:16 or 1:1: decide now, a vertical
cut is a framing of its own, and everything that enters or leaves the frame needs a position per format, see
`video/blender.md`, section 16), frame rate (24 unless the film is cut into other footage), sound, the owner's direction in his own words, and whether this is part of a
series. Take what the profile already says. If the
premise or the source is missing, ask for it, in one question. Everything else you decide, and you write the
assumption into the brief. Do not ask about the look: the pitches answer that.

## Step 3: the look, chosen by fit

The director writes the pitches; you check them before passing the treatment on.
- No list of looks to avoid and no default look, in the brief or in your instructions to the director. A list
  of things to avoid is itself an anchor: two agents given the same one avoided it in the same direction.
- Six or more one-paragraph pitches that differ in medium, not only in colour: drawn, painted, cut paper,
  stop-motion, miniature, stylised 3D, realistic 3D, photographic, typographic, or something on no list. When the
  owner fixed the medium, they vary staging, light, scale and camera inside it instead.
- The pick is argued from the premise, the audience and the owner's guidance. "Easy to build" is not an
  argument. If the best pitch needs something this setup lacks, the treatment says so and names the runner-up.
- Compare with the ledger's last five entries: the new look differs on medium or palette family, unless the
  owner asked for a series or for "the same as last time". Inside a medium he fixed, compare palette family and
  camera language.
- The owner's words override all of this, the profile and the ledger included.
- A studio or artist he names as a reference is turned into traits (painted backgrounds, soft natural light,
  limited animation) applied to original characters and scenes. Their characters and frames are not reproduced.

Show the owner the treatment's short form (six pitch names, the pick and why, the budget) and go on to step 4
in the same turn. Wait for him here only if he asked to approve the direction first or the budget passes a cap
he set.

## Step 4: one real sample before the rest

The owner decides by looking at one finished piece, not at descriptions. Follow `film/sample-first.md`: the
animator builds the treatment's signature shot at final quality, the engine adds its words and sound, and you
show a 100% still and the short MP4 with three lines on what to judge. Ask one question: is this the look for
the film? Then wait. A yes fixes the look, lens, focus rule and finishing for every later shot, and the shot
stays in the film. A correction goes back to the animator; offer to record it in the profile (`studio` skill,
"Update"). After two rejected samples, go back to the pitches with his words.

## Steps 5 to 11, in one paragraph each

**Plan.** The director turns the treatment into `plan/shots.json` (format in `video/shot-plan.md`) and
`plan/film-plan.md`: every shot with poses, camera, tracks, events, the exact label words and sound cues. Run
`reel plan plan/shots.json` yourself; exit 0 is the evidence.

**Animate.** One `reel-animator` per sequence of 3 to 4 shots, in plan order. Each reads `video/blender.md`,
`video/handmade.md` when the look must read as made by hand, the plan, and `plan/HANDOVER.md`
(`film/handover-template.md`), and appends its own section before it finishes. Intro and outro come last, as
their own short shots, when the plan or the profile calls for them. Where the film has a second format, everything
that enters, leaves or sits near a frame edge needs a position per format, and the three-pose check is run for each
format before its full render (`video/blender.md`, section 16).

**Render.** The queue on the Blender machine renders one job at a time. Check free disk space before each
submission (`film.disk_free_mb()`); a full disk once ended a job with a misleading status. Poll with
`film.status()` through the Blender tool (and read its `free_mb` each time: free space can fall while a job runs); bring each finished plate into `plates/<shot>/` and run
`reel plate plates/<shot>/tracks.json` on it.

**Assemble and measure.** The builder runs `reel assemble`, then stills, `reel qa --page-only`, `reel render`,
`reel qa` and `reel cuts`. The sound bed uses the engine palette `calm` unless the plan sets `sound.engine_palette`;
the director picks the palette that fits the tone and writes it into the plan. Label and sound fixes go into the side files beside the plan, never into the
generated `film.json`.

**Critic and fix.** `reel-critic` did not make the film. It checks facts, runs the AI-tell check and classes
each finding as spec fix, re-render (shot and poses) or leave (`film/critic-rubric.md`). You choose what to fix
by harm and cost: all spec fixes, re-renders only where the fault would be seen. One fix pass, then the critic
looks again at the changed shots only. There is no third round.

## Step 12: delivery, and what nobody saw or heard

Export (`film/pipeline.md`, step 12): the master, a smaller viewing copy (chat file sharing stops at 400 MB),
the treatment and the cue list the render wrote (`out/sound.json`). Then send the hand-over. It must say
plainly:
- Agents saw stills and measurements only. Nobody watched the film at speed and nobody listened to the sound.
  The owner should watch it once with sound before it goes anywhere.
- The moments to watch for, by time: the cuts the cut report flagged, every finding classed "leave", and each
  item in the critic's "Not checked".
- What was assumed at intake, and what the film cost (tokens by step, render minutes). A session that cannot read
  its own token use says so and reports tool calls, agent runs and render minutes instead; it does not estimate
  tokens as if measured.
- Which gates had nothing to measure (no labels: `layout` and `holds`; one shot: `cuts`): a PASS on zero items is
  not evidence.
- Zip files the transfer left on the Blender machine (`transfer/`), for him to delete.

Then offer two things: a ledger entry for this film (`studio` skill), and the publishing kit (`publish` skill).

## Budget

Write the budget into the treatment and keep to it; the owner may cap it. The measured figures of the first film (93 s, 16
shots) are in `film/pipeline.md`, "What each step costs". Generated images and footage cost money and are out of scope here.
Report actual against budget at delivery.
