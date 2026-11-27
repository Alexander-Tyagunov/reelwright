# One real sample before the rest

The owner judges by looking at one finished piece. Descriptions, mood words and flat style frames did not tell
him what the film would be; one shot at final quality did. So the first thing built is one shot of the film, at
the quality of the film, with its words and sound. It costs about a twelfth of the film and decides the rest.

## A film of one or two shots

For an ident or any film of one or two shots the sample is the whole film in its main format: there is no "rest" to
build until he has said yes, and the second format is built only after that. Labels, facts, chapters and the cut report
may be empty; the still and the MP4 are still what he judges.

## Which shot

The treatment's signature shot: the one that carries the central metaphor and has at least one character, one
label and one change of light. Keep it 6 to 10 seconds. It stays in the film when approved, so it is planned to
the same standard as every other shot (poses, camera, tracks, events, label words, cues).

## How it is made

1. Start `reel-animator` with the treatment, the brief, the signature shot section, `video/blender.md` and
   `video/handmade.md` (when the look should read as made by hand). It writes the film's look module (a
   `film.Look`) and the shot module in `blender/`, registers them with `film.register`, and writes a one-shot plan
   in `plan/shots.json` (`video/shot-plan.md`). Run `reel plan plan/shots.json` on it.
2. It builds, looks at live strips, calibrates the light on the first preview (light powers at table-top scale
   are hundredths of a watt), sets f-stop and focus from measured depths, and runs a three-pose check job at
   final settings. It measures edge energy of the subject crop (`reel_blender.checks.edge_energy`, in the
   workspace on staged frames) and looks at one still at 100%.
3. It runs the AI-tell check of `video/handmade.md`, section 3, on the check frames, fixes what fails, then
   queues the final render and records seconds per pose.
4. When the plate is in `plates/<shot>/` and `reel plate` passes, the builder (or you) assembles it alone:
   `reel assemble plan/shots.json --shots <shot> --out film-sample.json`, `reel render film-sample.json`,
   `reel qa film-sample.json`.
5. Save one frame at full size as `review/sample.jpg`: the frame with the most of the film's look in it, with
   its label. A film without labels uses the plate frame itself (`plates/<shot>/frames/<nnnn>.jpg`).

## What to show and ask

One message:

```text
Sample shot: <shot name>, <seconds> s, <medium in four words>.
Still at full size: review/sample.jpg. With words and sound: out/film-sample.mp4.
What to judge: the materials and light (every shot will look like this), the lens and focus, the labels.
What will change: the set and the cast from shot to shot; not the look.
Is this the look for the film?
```

Then wait for his answer. This is the one stop in the pipeline.

## What his answer does

- **Yes.** Write his words and the date under "Owner" in `treatment.md`. The look module's parameters, the lens,
  the f-stop and focus rule, the finishing pass and the seconds per pose are now fixed for the film; the
  director plans from them. Offer to record what he approved in the profile (`studio` skill, "Update").
- **A correction** ("looks a bit distorted", "doesn't feel like a person made it"). Quote it under "Owner",
  translate it into numbers with the animator (which f-stop, which grain, which material), rebuild the same shot
  and show it again with the same message. Offer to record the correction in the profile.
- **A second correction that rejects the medium.** Go back to the pitches with his words and choose again.
- **No answer yet.** Do not build further shots on an unapproved look; work on facts or the plan's prose while
  waiting.

## Examples of corrections and what fixed them

| His words | What it meant | What fixed it |
|---|---|---|
| "generic ... doesn't feel like a person made it" | clean default materials, no marks of making | paper with fibre and cut edges, tape, thread, tools and offcuts in frame, stop motion with hand jitter |
| "looks a bit distorted" | shallow focus at table-top scale, coarse grain, colour fringe | f/16, focus at the harmonic mean of measured depths, grain 0.010 at one pixel, no fringe |
| "let's have just title and call it a day" | too many words | the title alone |
