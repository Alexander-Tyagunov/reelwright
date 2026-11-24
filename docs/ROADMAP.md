# Roadmap: from slide films to creative films

Written 24 November 2026, when work was paused. It records what is finished, why the next phase exists, what is
planned, and the exact state of the two pieces of work that were stopped mid-way.

## Where things stand

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

1. Finish generated sound in the engine (see "Paused work").
2. Finish both films from their treatments: style frames, animation, gates, one render each.
3. Attach sound using each film's `soundPlan` and scene `cues`; run the full gate; look at the contact sheets.
4. Show both films to the owner. **This is the decision point.** If the level is not high enough, stage 2
   changes.

Estimate: 1 to 1.5 hours.

### Stage 2: put the creative pipeline in the plugin

Only after stage 1 is accepted.

**A new `film` skill**, the main path for anything that is not a recurring templated video:

1. Intake: premise, source, and whatever optional direction was given. One question at most.
2. Reference study, when references are given.
3. Treatment: three loglines with the most obvious one discarded; genre and tone; central metaphor; cast of
   original characters designed to be built from simple shapes; world, palette, type, materials, light, camera;
   the signature moment; the last line; a table mapping each story beat to the fact it carries.
4. Shot list: every shot with time, framing, camera move, action, exact on-screen words and sound cues.
5. Style frames of the three most important shots. Optional approval point.
6. Animation shot by shot, checked on motion strips.
7. Gates, one render, gates again.
8. Critic pass, then fixes. At most two rounds.
9. Deliver, with the treatment and the sound.

**Agents and model tiers**

| Agent | Model | Change |
|---|---|---|
| `reel-director` | Fable or Opus, high | Writes the treatment and shot list. Few tokens, largest effect on the result |
| `reel-auteur` | Fable, high | Becomes the main builder of a creative film, not an exception for one scene |
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
- Add a sameness check against the default look: fail a creative film that uses the bundled fonts with the
  default palette and built-in scene types.

**The 0.1.0 scene library stays**, as the fast path for recurring videos, but its default look is replaced and
it is no longer what "make me a video" means.

**Then:** tests for every new piece, docs and skills updated, the research report corrected (it filed camera,
depth and illustration under "wrong genre"), an independent review, version 0.2.0, repackage.

Estimate: 2 to 3 hours after stage 1.

### Later

- Narration. Set aside by the owner for now. Local voices keep the "sends no data" promise; a keyed voice
  service would have to be opt-in.
- Fonts beyond Latin and Cyrillic.
- A way for a film to carry a vendored drawing library when it is worth it. WebGL is slow without a GPU.

## Paused work

### Generated background sound

Branch `wip/generated-sound`, commit `84ff410`. **Unfinished and unverified.**

- Present: a pure-TypeScript synthesiser under `plugin/skills/video/scripts/audio/` (oscillators, envelopes,
  filters, noise, reverb, limiter, WAV writer, seeded random, scales and chords, a bed, cue sounds, palettes), a
  `sound` command, and edits to render, export, the audio gate, the spec loader and the contract.
- Verified: `npm run typecheck` passes. Nothing else.
- Missing: unit and end-to-end tests, lint, measurement of loudness and peak, docs, changelog.
- Intended design: `meta.sound` is `false`, `true` or `{ palette, bed, cues, volume, seed, key, tempo, intensity }`.
  Six palettes: `calm`, `bright`, `tense`, `minimal`, `epic`, `storybook`. Cues are derived from scene
  transitions and text settle times, and a scene can list its own: `tick`, `whoosh`, `rise`, `chime`, `hit`,
  `boom`, `pop`, `sting`. `reel render` attaches the track without re-encoding the video; `--no-sound` skips it.
  The finished track sits at -14 LUFS, true peak at or below -1 dBTP. Same spec, same samples.
- It is sound design, not composed music. Whether it is good enough has to be heard.

### The two films

In the session workspace under `/home/claude/work/films/`, and copied to the Mac (see "Where the files are"). Both
stopped after the treatment; neither has a scene yet.

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

**One warning from this:** both agents independently chose a printed, limited-ink look. They were both told what
to avoid, and avoided it in the same direction. Stage 2 needs a mechanism for variety, for example having the
director name the three most likely looks for a premise and choose outside them.

## Where the files are

On the owner's Mac, in `~/ClaudeProjects`:

| Path | What |
|---|---|
| `reelwright/` | The repository at 0.1.0, plus this file |
| `reelwright-0.1.0.plugin` | The installable plugin as delivered |
| `reelwright-samples/` | The six 0.1.0 sample films |
| `reelwright-wip/reelwright-all.bundle` | A git bundle with `master` and `wip/generated-sound` |
| `reelwright-wip/films-wip.zip` | The two film projects with their treatments |

To bring the paused branch into the repository on the Mac:
`git fetch ../reelwright-wip/reelwright-all.bundle "refs/heads/*:refs/remotes/paused/*"`.

## To resume

1. Read this file and the two `treatment.md` files.
2. `git switch wip/generated-sound`, finish and verify the sound work, then merge to `master`.
3. Start a build agent on each film with its treatment as the brief. The engine rules it must be told are in
   `plugin/skills/video/references/scene-api.md`; the process is the nine steps of the `film` skill above.
4. Attach sound, run the gates, show both films, and get the decision on stage 2.

## Decisions still open for the owner

- Whether the two test films clear the bar. Everything in stage 2 depends on it.
- Whether a creative film should stop for approval at the treatment and style frames by default, or run through.
- Whether a keyed voice service is acceptable for narration later, or local voices only.
- The author name in `plugin.json`, `marketplace.json` and `LICENSE`. It is set to "Alex Tyagunov".
