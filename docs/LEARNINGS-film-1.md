# What the first Blender film taught (November 2026)

Source notes for the 0.2.0 skills and references. Facts about outside services carry the date they were checked;
a skill that repeats them must tell the reader to check them again.

## The job

A 93-second stop-motion film (16 scenes: intro, 14 shots, outro) about a product's release history, rendered in
Blender as paper models on a desk, with tracked labels and generated sound, then published on YouTube with
channel art made in the same look. The owner's Mac ran only Blender and its MCP server; everything else ran in
the session's workspace.

## What the owner rejected, and what he accepted

| Rejected | His words | Accepted instead |
|---|---|---|
| The 0.1.0 scene films | "an animated powerpoint with the distinctive AI look" | A film with a premise, characters and a made world |
| Three looks art-directed by hand | "not a question of hardcoding the style" | A pipeline that develops a look per film |
| Two agents that chose the same printed look | "no pre-defined visuals or limits" | Six or more pitches that differ in medium; a ledger of past looks |
| The first clean Blender shot | "generic ... doesn't feel like a person made it" | Paper craft on a desk: visible materials, tools, imperfect cuts |
| The desk shot with shallow focus and coarse grain | "looks a bit distorted" | f/16, fine grain, no fringe: hand-made is not degraded |
| Flat vector channel art (dark navy, amber, monospace, glow) | "looks a bit AIish" | The same idea photographed: card, pencil, pins, a typeset title card |
| A tagline under the title | "let's have just title and call it a day" | Less text |

Pattern: he accepts an idea when a maker's hand and real materials are visible, and rejects the same idea drawn
flat and clean. He decides by looking at one finished sample, so show a real sample early (one shot, one still)
before producing the rest.

## Process that worked

1. Dataset first, checked against primary sources, before any picture.
2. Treatment, then a shot plan with poses, camera, tracks, events, label text and sound cues in one file. A
   validator computed reading time and label budget before any render.
3. One approved test shot fixed the look, the lens, the focus rule and the develop step for the whole film.
4. One animator per sequence, each reading the plan and a handover file, each appending corrections to the
   references. A fresh agent could follow the Blender reference from cold.
5. A render queue on the Blender machine, one job at a time, three-pose checks at final settings before every
   full render.
6. Assembly from the plan: a generator wrote the film spec; label fixes went in an overrides file, extra sound
   cues in another, never by editing the generated spec.
7. Review of the assembled film by an agent that had not made it, then one fix pass.
8. Intro and outro added last: the intro as a short Blender shot on the first shot's camera (so the cut is
   invisible), the outro as a hold built from the last static poses with end text composited.

## Faults that reached review

- Twelve frames of one shot rendered with a black foreground; the scene was identical on those frames and a
  re-render was correct. Cause unknown (a render-run fault). Needed: a check of every plate for frames whose
  brightness leaves the range of their neighbours.
- The engine added a whoosh at each cut and a chime at the last scene; on hard-cut plates the whoosh was the
  loudest sound. Now `meta.sound.auto` controls derived cues.
- A handwriting face drew "1M" as "IM". Check digits and capitals of a display face before using it for facts.
- Labels over subjects, and a caption left under the next label so it read as that label's fact.
- Cuts with large brightness jumps were measured but nobody judged them by eye.
- The disk of the Blender machine filled up during renders. Check free space before queuing and report it.
- Nobody listened to the sound and nobody watched playback: agents see stills and measurements only. Every
  hand-over must say so.

## Costs (tokens, rounded)

Director 350k; each sequence of 3 to 4 shots 350k to 420k; intro shot 230k; channel art 300k; sound engine
290k; each assembly pass 130k to 240k; review 180k. Rendering: 10 to 24 s a pose at 1080p on an M1 Pro, 12 poses
a second of film.

## Publishing on YouTube (checked 27 November 2026; check again before relying on any number)

- A video is a Short when it is square or vertical and at most 3 minutes. A 16:9 video of any length is a
  regular video. Decide the formats in the brief; a vertical cut is a separate framing, not a crop of 16:9
  plates with labels.
- Chapters: timestamps in the description, the first at 0:00, at least three, each at least 10 s. Scene starts
  from the film spec give exact times; merge scenes shorter than 10 s.
- Thumbnail: 1280 x 720, 16:9, under 2 MB; custom thumbnails need a phone-verified account. One subject, at
  most four words, readable at 160 px wide.
- Title up to 100 characters, the first 60 carry it. Tags matter little. Description: two plain lines first.
- The upload form asks whether AI made realistic content (a real person, a real event or place, a
  realistic-looking scene, music as the main focus). Clearly animated work is a "No"; say in the description
  how the film was made.
- End screens need room: an element shows for at least 5 s within the last 5 to 20 s. If the film should carry
  one, keep a quiet area in the ending and hold it for 5 s or more. A new channel has no video to suggest.
- Publish as unlisted, check the 1080p version, the thumbnail, the chapters and the sound, then make it public.
  Do not use a Premiere on a channel without subscribers.
- Phone verification unlocks custom thumbnails, videos over 15 minutes and live streams.
- Chat file sharing in this app stops at 400 MB; per-pixel grain makes large files. Keep a master and make a
  smaller viewing copy.

## Channel art (checked the same day)

- Banner 2560 x 1440; phones show the centre 1546 x 423, desktop the centre strip 2560 x 423, TVs all of it.
  Keep 60 px of margin inside the phone crop. Under 6 MB.
- Profile picture: 800 x 800, shown as a circle from 24 px. One bold shape; check at 88, 48 and 24 px on dark
  and on white.
- Watermark: 150 x 150, transparent outside one simple shape that carries its own ground; check at 56 px over a
  dark and a light frame.
- Empty channel settings worth filling: description, links, contact email, country, keywords, audience
  ("not made for kids"), upload defaults, trailer, one playlist per content line.
