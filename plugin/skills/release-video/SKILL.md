---
name: release-video
description: Turn release notes, a changelog, a list of merged pull requests or a version announcement into a short release video with Reelwright. Use when the user asks for a release video, changelog video, what's-new video, version or launch announcement clip, or a video for release notes.
---

# Release video

A release video answers one question in under 40 seconds: what can I do now that I could not do before? Follow
the pipeline in `${CLAUDE_SKILL_DIR}/../video/SKILL.md`; this file only changes steps 2 to 4.
CLI: `node ${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts <command>` (written `reel` below). If that folder is not next to this one, load this plugin's `video` skill and use the CLI path it gives.
Start from the template: `reel init <dir> --template release`.

## Facts (step 2)

Read the notes given in the arguments, or find them: `CHANGELOG.md`, the latest release notes, `git log` between
the two latest tags, or the pull requests the user points to. For a source longer than about 200 lines use
`reel-ingest`. Record in `content.json`: version, date, and for every change its user-facing title, one-line
benefit, kind (new / improved / fixed) and any number that proves it. Keep the source's product names and
figures exactly. Leave out refactors, dependency bumps and internal changes.

## Storyboard (step 3)

Rank changes by what a user will notice, not by commit order. Then fill this shape:

| # | Scene | Seconds | Content |
|---|---|---|---|
| 1 | `title` | 4.5 to 5 (5 with a subtitle) | Kicker = product and version. Title = the headline change as a benefit, 4 to 8 words. |
| 2 | `image` or `metric` | 5 to 6 | Proof of the headline: a screenshot with one callout, or the number that improved. |
| 3 | `changelog` | 2.5 + 1.1 per item | The 3 to 6 changes that matter, tagged new / improved / fixed. Titles of 2 to 6 words. |
| 4 | optional `code`, `compare` or `image` | 4 to 6 | One more feature worth showing, only if there is real material for it. |
| 5 | `outro` | 4 to 4.5 | Where to get it: upgrade command or URL, plus the version. |

Rules that keep it honest and watchable:
- Three strong changes beat ten listed ones. Put the rest behind "and N more fixes" in the changelog scene.
- Write benefits ("Exports finish 3x faster"), not implementation ("Rewrote the export worker").
- A number on screen needs a source in `content.json`. If the notes say "faster" without a figure, say "faster".
- Screenshots come from the user (`assets/`). Without one, use `metric`, `compare` or `code` instead of faking UI.
- Typical lengths: patch release 12 to 20 s, minor 20 to 35 s, major up to 45 s.

## Spec (step 4)

Use the brand from the user or the repository (logo in `assets/`, colours from the site or README). Then continue
with stills, render, QA and export exactly as the pipeline says. Suggested exports: `--preset x` for social,
`--preset slack` for the team channel, and a `--size 1080x1350` or `1080x1920` render for feeds.
