# Work order for 0.2.0: Blender films, steered by the owner's style

This file is the contract between the agents that build 0.2.0. Names fixed here are final; do not rename them.
It is deleted before the release (its content moves into the skills, references and CHANGELOG).

## What 0.2.0 must be

A person installs the plugin, has Blender open with its MCP server connected, and says "make a film about X"
(with or without references, a style, or a channel profile). A fresh session, reading only the plugin, takes
that to a finished, checked film and a publishing kit, in a look developed for that film and steered by that
person's recorded taste.

- **Requirements for the user: Blender (5.x) and a Blender MCP server.** Nothing else to buy or connect: no
  generation services, no other apps. The engine still needs Node 24, a Chromium browser and ffmpeg where the
  session's shell runs; in a cloud session these are there or can be installed by the session (Node 24 through
  npm), on a local machine `reel doctor` says what is missing. The README states this plainly.
- **Two layouts must both work and both be described:** (a) one machine: Claude Code, the engine and Blender on
  the same computer, files shared; (b) two machines: the session's workspace in the cloud, Blender on the
  user's computer behind a bridge, files moved with the bridge's stage and commit tools. The Blender MCP tool
  that runs Python has a different prefix in each layout; skills name it by what it does.
- **Steerable:** a studio profile and a look ledger in the user's project decide positioning, voice and taste;
  the user's words in the request override both; with no guidance the director must diverge (six or more
  pitches that differ in medium) and must not repeat the ledger's recent looks.
- **The 0.1.0 scene library stays** as the fast path for recurring, templated videos.

Out of scope for 0.2.0: generated images or footage, browser 3D, narration, a measured sameness score (the
ledger rule is enforced by the director and the critic in words).

## Sources to read (the knowledge to carry over)

- `docs/ROADMAP.md`, section "Stage 2" (the pipeline, the variety rules, the agent table).
- `docs/LEARNINGS-film-1.md` (what the first film taught, publishing and channel-art facts).
- `plugin/skills/video/references/blender.md` and `handmade.md` (already corrected by seven agents in use).
- The first film's project, `/home/claude/work/films/claude-timeline/`: `treatment.md`, `plan/film-plan.md`,
  `plan/shots.json`, `plan/validate.py`, `plan/HANDOVER.md`, `plan/ASSEMBLY.md`, `plan/REVIEW-part.md`,
  `plan/label-overrides.json`, `plan/extra-cues.json`, `plan/outro-texts.json`, `tools/*.py`, `blender/*.py`.
- The channel art project, `/home/claude/work/channel-identity/blender/*.py`.

## Fixed names

### Engine commands (TypeScript, `plugin/skills/video/scripts/`)

| Command | Does | Comes from |
|---|---|---|
| `reel plan <plan.json>` | Validates a shot plan: schema, totals, reading time per label and line against its shot, label budget per second, cue kinds, missing plates (warning). Exit 1 on a failure | `plan/validate.py` |
| `reel assemble <plan.json> --out <film.json> [--shots a,b] [--format 16:9] [--intro <plate dir>] [--outro <plate dir>]` | Writes the film spec from the plan, the plates' `tracks.json`, and the optional files beside the plan: `label-overrides.json`, `extra-cues.json`, `outro-texts.json`, `brand.json` | `tools/make_spec.py` |
| `reel cuts <film.json>` | After a render: for each cut, mean brightness before and after, and the momentary loudness jump; flags cuts beyond thresholds. Also part of `reel qa` as a warning-only gate named `cuts` | `tools/cutcheck.py`, `tools/loud.py` |
| `reel chapters <film.json>` | Prints video chapters from scene starts: first at 0:00, at least 10 s each (short scenes merge into the previous), titles from scene `chapter` fields or label text | done by hand for the first film |
| `reel plate <tracks.json>` (existing) | Gains a check for frames whose mean brightness (whole frame and lower third) leaves the range of both neighbours by a threshold; lists them; exit 1 | the black-desk fault |

The plan format is documented in a new reference `references/shot-plan.md` (schema, one worked example, the
three side files). Formats: the plan carries `formats` (for example `{"16:9": [1920,1080], "9:16":
[1080,1920]}`); plates for a second format live in `plates/<shot>@9x16/`; `reel assemble --format 9:16` uses
them. A shot may give a camera per format.

### Blender library (Python, `plugin/skills/video/blender/reel_blender/`)

| Module | Holds | Comes from |
|---|---|---|
| `film.py` | Plan-driven film work with no look in it: load a plan, a `Shot` object (scene, camera, poses, points, events), a registry where a film registers its look and its per-shot builders, `build_shot`, `strip` (live preview strip), `submit_check`, `submit` (all poses or a list, any format of the plan), `export_tracks`, `status`, extra shots outside the plan (intro) | the generic parts of `ct_film.py` |
| `lettering.py` | Text as image textures: hand lettering set letter by letter with seeded variation, and printed text with ink unevenness; returns a PNG and its metrics | `tools/make_tag_title.py`, channel art `make_textures.py` |
| `stills.py` | Still pictures from a scene: render at a size, develop, the small-size circle check sheet, centre crops for banner checks, a watermark cut | channel art `make_deliverables.py` |
| `checks.py` | Measurements used before a full render and after it: edge energy after a median, brightness of a frame or band, match of two frames (shift and brightness) | scattered in the film scripts |

An example film project ships in `plugin/skills/video/blender/examples/paper_desk/`: one look module, one shot
module, a three-shot plan, at most about 900 lines in all, reduced from the first film. It is an example of
structure, not a house style; its README says so.

### Skills (`plugin/skills/`)

| Skill | Purpose |
|---|---|
| `film` | The main path. The nine steps of the roadmap adapted to Blender: intake (reads the studio profile and ledger), treatment with six or more look pitches, one sample shot shown to the owner before the rest, shot plan, animation by sequence with handover, render queue, assembly, gates, critic, one fix pass, delivery with what was not seen or heard. Says which agent and model does each step |
| `studio` | Creates and updates `studio/PROFILE.md` (who the films are for, positioning, voice, what the owner accepted and rejected with his words, type and palette only if he fixed them, recurring motifs, intro and outro habits, formats and platforms) and `studio/ledger.json` (one entry per finished film: medium, palette family, type, texture, camera language, link). Offers to record feedback when the owner corrects a look |
| `publish` | The publishing kit for a finished film: title options, description with chapters from `reel chapters`, tags, thumbnail, upload settings, the unlisted-first check, formats per platform (regular video, Shorts and other vertical feeds, square), and channel art (banner, profile picture, watermark) as stills in the film's look. Every platform number is dated and the skill says to check current rules first |

`video` (the engine skill) gains a short "Films made in Blender" section that points to `film`.

### Agents (`plugin/agents/`)

| Agent | Model | Role |
|---|---|---|
| `reel-director` (changed) | opus | Pitches, treatment, shot plan; reads profile and ledger |
| `reel-animator` (new) | opus | Builds and animates one sequence in Blender from the plan; appends to handover and references |
| `reel-critic` (new) | opus | Did not make the film; fact check against the dataset, the AI-tell check, findings classed as spec fix, re-render or leave |
| `reel-builder` (changed) | sonnet | Assembly: `reel plan`, `reel assemble`, overrides, render, gates, cuts |
| others | unchanged | |

## Rules for every agent on this work

- Follow `CLAUDE.md` and `.claude/rules/*.md` of the repository. TypeScript for the engine; the Blender library
  is Python because Blender runs Python (keep its style consistent with the existing modules: docstrings on
  every public function, no dead code, small modules).
- No names of outside projects, people or sources in code or skill text. The example project uses neutral
  names (no product names in identifiers).
- Tests cover real use: the first film's plan and plates are the fixtures of record (copy a small subset into
  `tests/fixtures/`, a few frames per plate, downscaled).
- Commit your own files only (`git add <paths>`), with the two attribution lines the repository history uses.
- Report what you did not verify.
