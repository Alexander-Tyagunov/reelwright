# Brief for a bespoke scene

Use this when one scene has to be drawn from scratch by `reel-auteur`. A whole film made in Blender starts from a
different brief, the film's `brief.md` (premise, source, audience, length, formats, sound, the owner's direction
in his words, series, what came from the studio profile): see the film skill's `references/pipeline.md`, step 1.
A single Blender shot built inside such a film is briefed by the shot plan, not by this template.

A precise model given a vague brief returns a precise default, so every slot is a decision, written as a number
where one exists. Leave a slot empty only when you truly do not care; the agent will decide it and record the
decision.

```text
SCENE      <type name>, <seconds> s, inside a film at <W>x<H>, <fps> fps
JOB        What the viewer must understand or feel when it ends, in one sentence.
SUBJECT    The one thing on screen. One idea per shot.
FACTS      Names, numbers and labels that appear, exactly as they must read. Source for each.
TIMELINE   0.0-0.8 s  what happens
           0.8-2.5 s  what happens
           ...        one line per beat, to the end
LOOK       Background and palette from the brand variables. Line weight, fills, texture, in a sentence.
TYPE       Which copy appears (nothing else may), in which type class.
MOTION     Entrances ease out, cubic-bezier(0.16, 1, 0.3, 1). Moves between states ease in-out.
           Springs by damping ratio: 1.0 for text and UI, 0.8 for objects, 0.5 only for play.
           Nothing moves at constant speed except a deliberate scroll or sweep.
CAMERA     (3D only) position and target in metres, lens in mm, per beat. Cuts, not zooms.
SIZE       The subject is at least <N> px wide at 1080p in every beat. Measure and report it.
BANS       Defaults you do not want: glow orbs, gradient washes, lens flares, extra labels, drop shadows.
HOLD       What is on the last frame, and for how long it stays still.
CHECK      Stills at <t1, t2, t3>; a strip from <a> to <b> every 0.1 s.
DONE       The scene renders inside the film, `reel qa` passes determinism, layout and motion, and the stills at
           the listed times have been looked at. Report each check with its number.
```

## Follow-ups that work

A correction has four parts: where, what you observed, the change, and what stays as it is.

```text
Scene 4, 2.1 to 2.6 s: the label overlaps the arrow head.
Move the label 3u above the arrow and keep it there for the rest of the scene.
Keep the arrow timing, the colours and every other label as they are.
Show stills at 2.1, 2.4 and 2.8 s.
```

Change one or two things per message. "Make it better" gives the model nothing to act on; a time and a number
does.

## Adjective to number

| Instead of | Write |
|---|---|
| smooth | cubic-bezier(0.16, 1, 0.3, 1) over 0.6 s |
| bouncy | spring, damping ratio 0.5, about two bounces |
| snappy | 0.2 s, ease out, no overshoot |
| premium | one accent colour, 6u margins, nothing decorative |
| fast-paced | a new scene every 3 s, cuts instead of fades |
| readable | 0.3 s per word + 0.5 s still, at least 3u type |
