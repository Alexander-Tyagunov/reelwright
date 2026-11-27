---
name: video
description: Make a short video from code with Reelwright - a launch or feature video, a social clip, an animated summary of a document, or any motion graphics piece that ends as an MP4. Use when the user asks to make, create, generate or render a video, animation, motion graphic, animated chart or video presentation and no more specific Reelwright skill fits (film for a film made in Blender, release-video, metrics-video, explainer-video).
---

# Make a video

Reelwright turns a JSON film spec into an MP4. Scenes are prebuilt and brand-aware, a headless browser draws
every frame as a pure function of time, and a QA command measures the result. Your job is the part a tool cannot
do: decide what the video says, in what order, for how long.

CLI: `node ${CLAUDE_SKILL_DIR}/scripts/reel.ts <command>` (written `reel` below). Run `reel doctor` once per machine.
It needs Node 24 or newer, ffmpeg and a Chromium-family browser. If that path is not expanded, the CLI is
`scripts/reel.ts` inside this skill's folder; use its absolute path. If `node --version` is below 24, run
`npm install --prefix <dir> node@24` (for example `~/tools/node24`) and start every `reel` command with
`PATH=<dir>/node_modules/node/bin:$PATH`: shell state does not carry over between calls. `reel doctor` prints this advice
too.

## Films made in Blender

A film with a premise, original characters and a made world, rendered in Blender and assembled here, follows the
`film` skill (`${CLAUDE_SKILL_DIR}/../film/SKILL.md`): pitches, a sample shot shown first, a shot plan, animation
by sequence, assembly with `reel plan` and `reel assemble`, a critic, and a hand-over. Use it when the person asks
for a film, a story, a hand-made or stop-motion look, or says the result must not look like slides. It needs
Blender with its MCP server connected. The pipeline below is the scene library: the fast path for recurring,
templated videos (release notes every month, a metrics update), and the fallback when Blender is not there.

## The pipeline

Work in a project folder (`reel init <dir> --template blank|release|metrics|explainer`). Keep going until step 8 is
done; a failed render, a QA failure or a missing font is ordinary work, not a reason to stop.

1. **Brief.** Settle five things: who watches and where, the one thing they should remember, the source material,
   the format (see `${CLAUDE_SKILL_DIR}/references/formats.md`; default 1920x1080, 30 fps, 20 to 45 s), and the brand (colours, logo,
   light or dark). If the takeaway or the source is missing, ask once. Otherwise state your assumptions in one
   line and carry on.
2. **Facts.** Pull the content from the source into `content.json`: exact names, numbers and wording. Nothing in
   the film may be invented. For a long source (a changelog, a CSV, a long document) hand this to
   `reel-ingest`.
3. **Storyboard.** Write `storyboard.md`: one row per scene with type, duration, the exact on-screen words, and
   what moves. Follow `${CLAUDE_SKILL_DIR}/references/storyboard.md`; its numbers for words per scene and reading time are what the QA
   gate enforces. List scene types with `reel scenes`.
4. **Spec.** Write `film.json` (`${CLAUDE_SKILL_DIR}/references/film-spec.md`). Use built-in scenes; they adapt to 16:9, 1:1 and 9:16.
5. **Stills before any render.** `reel stills film.json`, then open `out/contact.jpg` and look: hierarchy, wrapping,
   empty space, anything cramped. Fix the spec and repeat. Stills take seconds and a render takes minutes, so do
   the visual fixing here. For more formats add `--size 1080x1920`. `reel qa film.json --page-only` runs the
   determinism, layout, holds and pacing gates in seconds without a render; fix holds and layout failures there,
   before rendering.
6. **Render.** `reel render film.json`. Scenes that did not change are reused, so later renders are fast. For sound,
   set `meta.sound` and choose the palette that fits the tone (`calm`, `bright`, `tense`, `minimal`, `epic`,
   `storybook`). It is generated sound design, not composed music: say so, and list the palette (`film-spec.md`, "sound").
7. **Measure.** `reel qa film.json`. Every gate must pass: determinism, layout, reading holds, pacing, file
   properties, motion. Fix what it reports with a scoped edit, re-render, re-run. Details: `${CLAUDE_SKILL_DIR}/references/qa-gates.md`.
8. **Deliver.** `reel export film.json --preset <x|linkedin|youtube|slack|web|gif|webm> --poster auto`. Report the file
   paths, duration, the QA table, and anything you assumed. Say plainly that you measured the film and looked at
   stills but cannot watch it: the person should press play once before publishing. When the film is going to
   be posted, also write `out/export/post.md`: a title of up to 70 characters, a two-sentence description, alt
   text that says what the video shows, and the name of the poster file.

For a film longer than about 45 seconds, or whenever the person asked to approve the direction first, stop
after step 5: show the storyboard and the contact sheet, and offer a quick `reel render film.json --draft`
(half the width and height, 15 fps). Build the full film once they agree. Fixing a storyboard costs seconds; fixing a
finished render costs a re-render.

## Who does what

Subagents cost a cold start each, so use them where they pay for themselves. A short film from clear material
(up to about 6 scenes, built-in scenes only) is fastest done entirely in this session.

| Situation | Hand to | Model |
|---|---|---|
| Long or messy source to turn into facts | `reel-ingest` | Haiku |
| Renders, exports, QA runs with long logs | `reel-runner` | Haiku |
| The message or structure is not obvious; more than 8 scenes; tone matters | `reel-director` writes the storyboard | Opus |
| Many scenes, several formats, or a new 2D scene type | `reel-builder` | Sonnet |
| The film will be published outside the team | `reel-reviewer`, who did not build it | Opus |
| Blender film: build and animate one sequence, the sample shot, re-renders | `reel-animator` | Opus |
| Blender film: independent review of the rendered film | `reel-critic`, who did not make it | Opus |
| 3D, a bespoke illustrated explanation, physics or character motion that no scene covers | `reel-auteur` | Fable |

Give each subagent the project folder, the files to read, the one output you want, and the limits: one
render command at a time (the renderer already draws two scenes in parallel; `--jobs` sets the number), at most 3 fix rounds on the same
failure, at most 2 review rounds. Reasons and prices: `${CLAUDE_SKILL_DIR}/references/model-routing.md`.

## Choosing how to build a scene

1. A built-in scene fits (`reel scenes`): write spec only. This is the normal case.
   A 3D shot rendered elsewhere (Blender) with labels that follow objects is the built-in `plate` scene
   (`${CLAUDE_SKILL_DIR}/references/film-spec.md`, section "plates").
2. A new 2D layout is needed: add a custom scene (`add-scene` skill, `${CLAUDE_SKILL_DIR}/references/scene-api.md`).
3. One hero moment needs to be bespoke: brief `reel-auteur` using `${CLAUDE_SKILL_DIR}/references/brief-template.md`.
4. The whole project needs another engine (a React component library, math animation, real 3D):
   `${CLAUDE_SKILL_DIR}/references/engines.md` says when Remotion, HyperFrames, Manim or Blender is the better tool and what each costs.

## What makes these films good

- One idea per scene and few words: the scene types hold 3 to 14 words per block for a reason.
- Decisions are numbers: durations in seconds, colours in hex, a damping ratio rather than "bouncy".
- Text is still while it is read: 0.3 s per word plus 0.5 s after it lands.
- Something is on screen in the first half second, and the last frame works as a poster.
- No decoration that carries no information: no glow orbs, no gradient washes, no stock icons.
