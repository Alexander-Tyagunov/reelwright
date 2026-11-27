---
name: publish
description: Prepares a finished film for publishing - title options, a description with chapters, tags, a thumbnail, the upload settings with the AI-content answer reasoned out, an unlisted-first check, what each format needs per platform (regular video, Shorts and other vertical feeds, square), and channel art (banner, profile picture, watermark) made as stills in the film's own look. Use when the user says "prepare this video for YouTube", "publishing kit", "write the title and description", "add chapters", "make a thumbnail", "channel banner", "profile picture for the channel", "watermark", "can this be a Short", or "what do I fill in on the upload page". It prepares files in a publish folder; it never uploads, publishes or changes an account - the owner does that.
---

# Prepare a film for publishing

You prepare; the owner acts. Everything this skill makes is a file in `publish/` beside the film, plus a list of
settings for him to enter. Do not upload, publish, schedule or change any account setting yourself, even when a
browser or an account tool is available: publishing speaks for him in public, and an upload form asks him to
declare things only he can declare.

Names used below: `reel` is `node ${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts`; `refs/` is
`${CLAUDE_SKILL_DIR}/references/`.

## Before you write anything

1. Read the studio profile and ledger (`studio` skill, "Read"): audience, voice, platforms, fixed title or brand
   elements, intro and outro habits.
2. Read the film's `brief.md`, `treatment.md` and `content.json`, and find the film spec (`film.json`) and the
   rendered master (`out/film.mp4`). Get the duration and size:
   `ffprobe -v error -show_entries format=duration:stream=width,height -of csv=p=0 out/film.mp4`.
3. Platform rules change. Every number in `refs/platforms.md`, `refs/upload-checklist.md` and
   `refs/channel-art.md` carries the date it was checked. Before relying on one, run a web search for the
   platform's current rule (for example "YouTube chapters requirements", "YouTube Shorts length", "YouTube banner
   size") and use what the platform's own help pages say today. Where it differs, use the new value and tell the
   owner which number changed.

## The kit

Make `publish/` beside the film and write these files:

| File | What | How |
|---|---|---|
| `titles.txt` | three to five title options, best first, with one line on each | `refs/upload-checklist.md`, "Title" |
| `chapters.txt` | the chapter list, timestamp lines only | `reel chapters film.json > publish/chapters.txt`, then read it |
| `description.txt` | two plain lines, how the film was made, the chapters, links | "Description" |
| `tags.txt` | a short list, comma-separated | "Tags" |
| `thumbnail.jpg`, `thumbnail-160.jpg` | the thumbnail and its small-size check | "Thumbnail" |
| `settings.md` | every field of the upload form with the value to enter, and the AI-content answer with its reasoning | "Settings" |
| `formats.md` | which formats this film can go out in, per platform, and what each one still needs | `refs/platforms.md` |
| `channel/` | banner, profile picture, watermark and their check sheets, only when asked | `refs/channel-art.md` |

Done when every file exists, `thumbnail.jpg` is 1280 x 720 and under 2 MB (`ffprobe` and `ls -l`), you have opened
`thumbnail-160.jpg` and can read it, and `chapters.txt` starts at 0:00.

## Formats

Read `refs/platforms.md`. A 16:9 film of any length is a regular video. A vertical or square version is a
separate film, not a crop: it needs a camera per format in the plan, plates of its own in `plates/<shot>@9x16/`,
`reel assemble plan/shots.json --format 9:16 --out film-9x16.json`, a render, and the gates at 1080 x 1920. Write in
`formats.md` what exists, what a vertical version would need (shots, total poses from `plan/shots.json`, render
hours at the seconds per pose measured in `plan/HANDOVER.md`) and the cheaper option of a shorter vertical cut of
selected shots (`--shots`). Do not make one unless the owner asks; it is a film-sized job. A scene-library video
is different: its scenes re-lay themselves out, so the vertical version is `reel render film.json --size
1080x1920` and `reel qa film.json --size 1080x1920`.

## Channel art

Only when asked, or when the profile says the channel is new and the owner agrees. Follow `refs/channel-art.md`:
banner, profile picture and watermark are stills rendered in the film's own look in Blender (the film skill's
setup applies), with the title only, then checked at their crop and small sizes. Show him the check sheets, not
only the full images.

## Hand over

Reply with the paths, the recommended title, the AI-content answer and why, and the order to do things in:
upload as unlisted, check the 1080p version, the thumbnail, the chapters and the sound on the platform, then make
it public. Say plainly that you prepared files and did not upload or change anything, and that nobody has listened
to the film or watched it at speed if that is still true (see the film's hand-over).

When the owner approves or corrects a title, thumbnail or channel art, offer to record his words in the profile
(`studio` skill, "Update").
