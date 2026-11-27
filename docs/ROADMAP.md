# Roadmap: from slide films to creative films

Written 24 November 2026, when work was paused. It records what is finished, why the next phase exists, what is
planned, and the exact state of the two pieces of work that were stopped mid-way.

## Where things stand

**Update, 27 November 2026: stage 2 is done for the Blender path (Reelwright 0.2.0).** The `film`, `studio` and `publish`
skills, the director, animator and critic agents, the shot plan, `reel assemble`, the Blender library and its example
project exist, and a fresh session that could read only the plugin made a 6-second film in two formats with them (see
`docs/TESTING.md`, "Cold-start test"). What remains is listed under "Stage 2" below. The text after this paragraph is the
roadmap as written on 24 November 2026, kept for the reasoning.

**Finished and delivered: Reelwright 0.1.0** (`master`, commit `3fc66eb`). A JSON film spec is rendered to MP4 by
twelve built-in scene types, measured by a quality gate, with six skills and six model-pinned agents. 152 unit
tests and 43 end-to-end scenarios pass; an independent review's 21 findings are fixed. See `docs/TESTING.md`.

**The owner's verdict on 0.1.0:** the engineering is fine, the films are not. Every film looks the same: "an
animated PowerPoint with the distinctive AI look". There is also no sound. That verdict is correct and it sets
the next phase.

## Why 0.1.0 films look the same

1. The scene types are a slide taxonomy: title, bullets, metric, compare, quote. Content poured into them comes
   out as slides.
2. One design language is hard-coded. `brand` changes colours and fonts only; layout, composition, materials,
   motion and transitions never change.
3. The default look is what a language model produces unprompted: near-black background, Inter, a purple accent,
   rounded cards, chips.
4. The pipeline has no art-direction step. It decides words and seconds, never a concept, a world or a character.
5. Creative work was sent to the cheapest tier. The one bespoke path was limited to "one scene, if nothing else
   fits", and the skill text forbids decoration.
6. The gates measure legibility and motion. Nothing asks whether the film has an idea.

## What the plugin must do instead

The owner's words: "Here are the release notes, make a blockbuster out of it, make a small movie about someone
fighting bugs and then comes a new feature", and the result is a creative, individual, animated film of one to
two minutes. Not a larger set of hard-coded styles.

The contract:

- **Only the premise is required.** References (images, links, a video file), style guidance, brand, tone, length
  and format may each be given or left out. What is missing, the agent decides and writes down. What is given,
  it follows.
- **No predefined visuals.** The creative path has no default palette, typeface, scene type, layout or look, and
  no list of styles to pick from. The look of each film is invented for that film, or taken from the owner's
  guidance when there is any.
- **No limit on the medium.** The range runs from flat graphics through hand-drawn, anime-like painted animation
  to stylised and realistic 3D. The agent chooses the medium the film needs, not the one that is easiest to
  code. What a given machine can actually render is reported up front, never silently substituted (see
  "Rendering backends").
- **No habit.** Two films must not come out alike because the same model made them. Variety is a measured
  requirement with its own check (see "Variety").
- **References are studied, not copied.** Images are read directly. A video file is turned into a contact sheet
  and a motion and cut-rhythm measurement. The agent states what it takes: palette, materials, composition,
  pacing. Other people's characters and designs are not reproduced.
- **Product facts stay true.** Story, characters and metaphor are invented. Every feature name, number, command
  and version on screen comes from the source material.
- **Quality comes from loops**, not one pass: treatment, style frames, shot-by-shot animation checked on strips,
  measured gates, then a critic that did not build the film.
- **A person can step in** at the treatment or the style frames, or let it run.
- **One limit is permanent:** the agent cannot watch at speed or listen. The last judgment on rhythm and feel is
  a person's.

## Planned work

### Stage 1: prove it before building it (paused part-way)

Two films from the same Tessera 3.2.0 release notes, with no look prescribed, to see whether the ceiling is high
enough before the plugin is changed.

| Film | Premise given to the agent | Length |
|---|---|---|
| Blockbuster | The owner's sentence, verbatim | 60 to 75 s |
| Picture book | "A quiet picture book for grown-ups: a bedtime story about a lighthouse keeper whose messages used to arrive late" | 35 to 45 s |

Remaining steps:

1. Generated sound in the engine: finished (see "Paused work").
2. Re-open the look of both films before building. Their stories stand; their look does not, because both
   agents landed on the same printed, limited-ink style. Run the variety procedure below on each and require
   the two films to use different media.
3. Range test, so the ceiling of each medium is known before anything is promised. One 8 to 10 second shot of
   the same story moment in each of:
   - hand-drawn, anime-like painted animation: painted background, cel-shaded character, multiplane camera
   - stylised 3D drawn in the browser
   - realistic 3D rendered in Blender on the owner's Mac (its Blender connection is already present)
   - one generated-footage shot, only if the owner allows a generation service
4. Finish both films in their chosen media: style frames, animation, gates, one render each.
5. Attach sound using each film's `soundPlan` and scene `cues`; run the full gate; look at the contact sheets.
6. Show the range test and both films to the owner. **This is the decision point.** If the level is not high
   enough in a medium, stage 2 changes for that medium.

Estimate: 2.5 to 4 hours, most of it the range test and the Blender and painted shots.

### Stage 2: put the creative pipeline in the plugin

**Done for the Blender path in 0.2.0** (the nine steps are the `film` skill; the variety rule is the director's six pitches
and the ledger; the critic is `reel-critic`). **Still to do:**
- **Measured sameness.** The ledger rule (a new look differs on medium or palette family from the last five) is enforced in
  words by the director and the critic; nothing measures how alike two films look.
- **A selector agent** that chooses among the pitches; today the director argues the pick and the owner may overrule it.
- **Browser 3D** as a second rendering backend, drawn in the page.
- **Generated shots** (images and footage from a generation service), within the owner's cost cap. Out of scope in 0.2.0.
- **Narration.** Set aside by the owner; see "Later".
- Not tested yet: the fixes made after the cold-start test, by a second cold run; sound and motion at speed, which no
  agent can judge.

The plan as first written:

**A new `film` skill**, the main path for anything that is not a recurring templated video:

1. Intake: premise, source, and whatever optional direction was given. One question at most.
2. Reference study, when references are given.
3. Treatment: three loglines with the most obvious one discarded; genre and tone; central metaphor; cast of
   original characters; at least six pitches for the look that differ in medium, the one chosen and why, and
   the backend it needs (see "Variety" and "Rendering backends"); world, palette, type, materials, light,
   camera; the signature moment; the last line; a table mapping each story beat to the fact it carries.
4. Shot list: every shot with time, framing, camera move, action, exact on-screen words and sound cues.
5. Style frames of the three most important shots. Optional approval point.
6. Animation shot by shot, checked on motion strips.
7. Gates, one render, gates again.
8. Critic pass, then fixes. At most two rounds.
9. Deliver, with the treatment and the sound.

**Variety: no house style, by construction**

What went wrong in the first attempt: both agents were told which look to avoid, and both avoided it in the same
direction. A list of things to avoid is itself an anchor. So:

1. *No avoid-lists and no defaults.* The brief describes the film's purpose and audience. It names no look to
   use and none to avoid.
2. *Diverge before choosing.* The director first writes at least six one-paragraph pitches that differ in
   medium, not only in colour: for example drawn, painted, cut paper, stop-motion, miniature, stylised 3D,
   realistic 3D, photographic, typographic, pixel, or something on no list. The list is a prompt to spread out,
   not a menu; a pitch outside it is welcome.
3. *Choose by fit, and say why.* The pick is argued from the premise, the audience and the owner's guidance.
   "Feasible in 2D code" is not an argument; if the best pitch needs a backend this machine lacks, the treatment
   says so and names the runner-up.
4. *A look ledger.* Each finished film records its medium, palette, type, texture and camera language in the
   project. A new film must differ from the last several on at least medium or palette family, unless the
   owner asks for a series.
5. *Measure sameness.* Style frames are compared with the ledger and with the fingerprints of known default
   looks: colour histogram, edge density, texture statistics, typefaces. Too close sends the look back.
6. *Independent pitches for important films.* Several pitch agents with different starting constraints, then a
   separate selector, so one model's first instinct does not decide.
7. *The owner's guidance always wins.* "Anime-like", "realistic", a reference image or "same as last time"
   overrides all of the above.

A named studio or artist given as a reference is translated into traits (painted backgrounds, soft natural
light, limited animation) and applied to original characters and scenes. Their characters and frames are not
reproduced.

**Rendering backends: capable of any visual**

Code-drawn 2D cannot produce a painted anime frame or a photoreal shot. Pretending otherwise is how every film
ended up flat. The engine becomes a timeline that accepts shots from any backend and still owns text, sound,
assembly and measurement.

| Backend | Good for | Needs | State |
|---|---|---|---|
| Code-drawn 2D (DOM, SVG, canvas) | Graphic, typographic, cut-out, diagram, cel-like shapes | Nothing extra | Exists |
| Real-time 3D in the browser | Stylised 3D, camera moves, particles, lighting | A GPU for speed; a 3D library carried by the film project | Planned |
| Blender | Realistic materials and light, physics, cinematic camera, also toon shading | Blender on the machine; renders run there | Planned; a Blender connection exists on the owner's Mac |
| Generated images | Painted backgrounds, character sheets, textures, matte paintings | An image-generation service the owner allows | Planned, opt-in |
| Generated footage | Shots that cannot be drawn or modelled in the time | A video-generation service the owner allows | Planned, opt-in |
| Supplied assets | Footage, illustrations, 3D models, screen recordings | Files from the owner | Partly exists (images) |

What this requires:

- A shot can be a code scene, an image sequence or a video clip. Text and graphics can be composited over any
  of them.
- `reel doctor` reports capabilities: GPU, Blender, connected generation services. The director chooses within
  them and states which backend it wanted and could not use.
- Character and style consistency across generated shots: a character sheet and style frames made first and
  used as conditioning for every later shot.
- Gates per backend. Determinism applies to code shots only. Motion, file and audio gates apply to everything.
  Layout and reading time apply to composited text. Generated shots get their own checks: continuity of
  character and palette between shots, and artefacts flagged for a person to look at.
- Honest cost and time reporting. A Blender or generated shot costs minutes or money per shot; the treatment
  carries a budget and the owner can cap it.
- Nothing leaves the machine unless a generation service was enabled; the README says which backends send data.

**Agents and model tiers**

| Agent | Model | Change |
|---|---|---|
| `reel-director` | Fable or Opus, high | Writes the pitches, the treatment and the shot list, and chooses the medium. Few tokens, largest effect on the result |
| `reel-auteur` | Fable, high | Becomes the main builder of a creative film, not an exception for one scene. Works in whichever backend the treatment chose |
| `reel-selector` (new) | Opus, medium | Picks among independent pitches and runs the sameness check against the ledger |
| `reel-critic` (new) | Opus, medium | Did not build the film. Scores idea, character appeal, staging, rhythm and finish against a rubric and returns frame-specific corrections |
| `reel-builder` | Sonnet, medium | Re-uses an existing film's look and rigs for the next episode of a series |
| `reel-ingest`, `reel-runner` | Haiku | Unchanged |

The cost rule that keeps this affordable: the strong model designs a world once; a cheaper model makes the next
film in that world. A weekly release video does not pay for a new concept every week.

**An animation toolkit in the engine**, so each film does not rebuild the basics. The list comes from what the
stage 1 agents have to build for themselves (each writes a `NOTES.md` for this):

- a camera: position, zoom, rotation, shake, parallax between depth layers
- a shared world across shots, so a film is not a stack of unrelated layers
- character rigs: parts, joints, squash and stretch, blink and gaze, idle motion
- closed-form particles and debris from a seed
- seeded paper, grain, ink and halftone textures
- line drawing over time
- cuts, wipes and match cuts as first-class transitions

**Gates for story films**

- Keep every existing gate.
- Words that are part of the picture need a way to be marked as decoration, so tilted, cropped or overlapping
  lettering does not fail layout.
- Add a facts check: every number and product name on screen appears in `content.json`.
- Add the sameness check described under "Variety": against the look ledger and against known default looks.

**The 0.1.0 scene library stays**, as the fast path for recurring videos, but its default look is replaced and
it is no longer what "make me a video" means.

**Then:** tests for every new piece, docs and skills updated, the research report corrected (it filed camera,
depth and illustration under "wrong genre"), an independent review, version 0.2.0, repackage.

Estimate: 2 to 3 hours for the pipeline, the variety mechanism and the 2D toolkit. Each further backend is its
own piece of work: roughly 2 hours for browser 3D, 3 to 4 for Blender, 2 to 3 for generated images and footage
once a service is chosen. These are rough; the range test in stage 1 will correct them.

### Later

- Narration. Set aside by the owner for now. Local voices keep the "sends no data" promise; a keyed voice
  service would have to be opt-in.
- Fonts beyond Latin and Cyrillic.
- A way for a film to carry a vendored drawing library when it is worth it. WebGL is slow without a GPU.

## Paused work

### Generated background sound

Finished: merged onto `master` (synthesiser in `scripts/audio/`, `reel sound`, render and export wiring, audio gate, tests, docs); whether it sounds good still has to be heard.

### The two films

In the session workspace that made them, not in this repository. Both stopped after the treatment; neither has a scene yet.

| Film | Done | Not done |
|---|---|---|
| `blockbuster/` "Release Night" | `treatment.md` (131 lines), fonts with licences, `lib/ink.ts` started | Scenes, style frames, animation, gates, render |
| `picturebook/` "The Keeper and the Thirty-Second Gull" | `treatment.md` (116 lines), fonts with licences | Everything after the treatment |

The treatments are worth reading as evidence. Given only a premise, both agents discarded their most obvious
idea and wrote a specific one:

- *Release Night*: the keeper of a harbour town's flag tower fights house-sized bugs with a rubber stamp that
  prints FIXED; each bug behaves like its real bug report; the new feature arrives as a clockwork winch that
  raises the flag one notch at a time and brakes when trouble shows. The town has exactly 100 windows.
- *The Thirty-Second Gull*: a lighthouse keeper's news is carried by a gull that only calls every thirty
  seconds, so it is always late; one evening the news streams down the lamp's beam and the gull, out of work,
  falls asleep on her hat.

**What this exposed:** both agents independently chose a printed, limited-ink look. They were both told what to
avoid, and avoided it in the same direction, inside the one medium they had. That is now a requirement, not a
note: see "No predefined visuals", "No limit on the medium" and "No habit" in the contract, and "Variety" and
"Rendering backends" in stage 2. Neither film is built in that look until the variety procedure has been run.

## Where the files are

Not in this repository: the 0.1.0 plugin package, the six 0.1.0 sample films, a git bundle with the paused sound branch (it
has since been merged) and the two film projects with their treatments are kept by the owner, next to his clone of the
repository.

## To resume

1. Read this file and the two `treatment.md` files.
2. The sound work is already on `master`; the branch `wip/generated-sound` is no longer needed.
3. Run the variety procedure on both films and do the range test (stage 1, steps 2 and 3).
4. Build each film from its treatment in the medium chosen. The engine rules a build agent must be told are in
   `plugin/skills/video/references/scene-api.md`; the process is the nine steps of the `film` skill.
5. Attach sound, run the gates, show the range test and both films, and get the decision on stage 2.

## Decisions made by the owner (24 November 2026)

- **Blender plus code comes first.** It is the primary way to make a film; generated imagery is secondary. The
  owner will start Blender on the Mac; it must be running with its MCP add-on server for the session to reach it.
- **Blender may be driven** for scene building and renders.
- **Generation services: Google only, through the owner's own Google Cloud project** on the Gemini Enterprise
  Agent Platform (the renamed Vertex AI). No aggregator, no other provider.
- **Budget: $1 to $5 of external spend per 30 to 90 second film.** Blender and code cost nothing external, so
  they carry the film. Generated footage is an accent of a few shots, not the body.

What the Google research found, read from Google's documentation and price list on 24 November 2026:

| Use | Model ID | Price | Notes |
|---|---|---|---|
| Video | `gemini-omni-1.2-flash` (GA 5 Nov 2026) | Billed in tokens: 1,931 / 5,792 / 8,688 / 17,376 per second at 360p / 720p / 1080p / 4K. Secondary sources give $12 per million, about $0.07/s at 720p; Google's page showed only the 1.1 rate of $17.50 | Interactions API at `locations/global`. 3 to 15 s. Text, image, first and last frame, references, extend, edit. Named by Google as the replacement for Veo 3.1 |
| Video, cheapest | `veo-3.1-lite-generate-001` (preview) | $0.03/s at 720p, $0.05/s at 1080p, without audio | `predictLongRunning` in `us-central1`. 4, 6 or 8 s |
| Images | `gemini-nano-banana-2.1`, `gemini-3.1-flash-lite-image` | About $0.034 per 1K image; batch is half | Imagen was retired on 30 June 2026 |
| Images, best | `gemini-3-pro-image` | $0.134 per 1K or 2K image | For hero frames only at this budget |
| Music | Lyria 3, Lyria 3 Pro | $0.04 per 30 s clip, $0.08 per full song | An alternative to the synthesised bed |
| Watching the film | Gemini 4 family (`gemini-4-argon` GA; `-carbon`, `-hydrogen`, `-neon` short-term availability) | Token-priced reasoning models | They do not generate media. They accept video and audio as input, so one could review a finished film at speed. To be verified |

There is no Veo 4. What $5 buys at these prices: about 70 s of Omni footage at 720p, or about 165 s of silent
Veo Lite at 720p, before retakes. With three takes per shot that is roughly 20 to 55 s of usable footage, which
is why generated shots stay an accent.

Calls to Google must run where the owner's `gcloud` credentials are, which is the Mac, not the cloud session.
The engine needs a project ID and a Cloud Storage bucket for video output.

## Decisions still open for the owner

- Whether the two test films clear the bar. Everything in stage 2 depends on it.
- Whether a creative film should stop for approval at the treatment and style frames by default, or run through.
- Whether a keyed voice service is acceptable for narration later, or local voices only.
- Whether long Blender renders on the Mac are acceptable, and a time budget per film.
- The Google Cloud project ID and bucket to use, when generated shots are wanted.
- The author name in `plugin.json`, `marketplace.json` and `LICENSE`. It is set to "Alex Tyagunov".
