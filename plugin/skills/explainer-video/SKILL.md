---
name: explainer-video
description: Make a short educational or explainer video with Reelwright - how something works, a concept, a process, an architecture, a how-to, a lesson, onboarding or training material. Use when the user asks for an explainer, an educational or tutorial video, a concept or how-it-works animation, or a video that teaches or walks through something.
---

# Explainer video

An explainer changes what one specific viewer understands. Decide who that viewer is and what they will be able
to say afterwards before choosing a single scene. Follow the pipeline in
`${CLAUDE_SKILL_DIR}/../video/SKILL.md`; this file changes steps 1 to 4. Start from the template:
`reel init <dir> --template explainer`.

## Brief (step 1), two extra decisions

- The viewer and what they already know. This sets the vocabulary: a term the viewer does not know either gets
  one scene of its own or does not appear.
- The single sentence they should be able to repeat. Write it down; it becomes the last content scene.

## Facts (step 2)

Read the source and check every claim against it. When explaining from general knowledge, verify anything that
could be out of date before it goes on screen, and keep the list of sources in `content.json`.

## Storyboard (step 3)

Give this to `reel-director` unless the topic is small and you already see the structure. The shape:

| # | Scene | Seconds | Job |
|---|---|---|---|
| 1 | `title` | 3 to 4 | The question the video answers, in the viewer's words. |
| 2 | `bullets`, `compare` or `image` | 5 to 7 | The problem or the familiar starting point. |
| 3 to 5 | `flow`, `code`, `line-chart`, `bar-chart`, `image` | 5 to 8 each | One step of the idea per scene, each building on the last. |
| 6 | `quote` or `bullets` | 4 to 6 | The takeaway sentence. |
| 7 | `outro` | 3 | Where to learn more. |

Teaching rules:
- One new idea per scene. If a scene needs two sentences of narration to justify it, split it.
- Show the thing, then name it. A `flow` that builds step by step teaches more than a finished diagram.
- Concrete before abstract: a real example, a real number, real code that runs.
- Reuse the same word for the same thing in every scene.
- Length: 45 to 90 s for one concept. Longer topics become a series, one concept each.

Narration and captions are optional. Without a voice track the on-screen text carries everything, so give each
block its full reading time. With a voice track from the user, put the transcript lines in `captions` in the
spec with their times, keep on-screen text to key terms, and add the audio at export (`--audio`).

When a concept needs a picture no scene can draw (a mechanism, a spatial process, an animation of the thing
itself), that one scene is a job for `reel-auteur`; see `${CLAUDE_SKILL_DIR}/../video/references/brief-template.md`.

## Spec (step 4)

Then stills, render, QA and export as the pipeline says. For teaching material the independent review is worth
its cost: ask `reel-reviewer` to check the film as the stated viewer.
