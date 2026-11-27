# Critic rubric

The critic reviews an assembled, rendered film it did not make. It is independent: it starts from the brief and
the facts, not from the makers' notes, and it judges what is on screen, not what the plan meant. The worked
example of a good review found a key light going out for seven poses, a handwriting face drawing "1M" as "IM",
labels sitting on the characters they named, and a sound effect on every cut that was louder than anything else.

## What to read and run

1. `brief.md`, `treatment.md` (only "Premise", "Central metaphor", "Story beats and facts", "Owner"),
   `content.json` and `data/REVIEW.md`. Read the plan and the handover only to find a cause, after you have
   seen the fault.
2. Run the gates yourself: `reel qa film.json` and `reel cuts film.json`. Do not rely on a table someone pasted.
3. Extract frames with ffmpeg from the rendered film (`ffmpeg -ss <s> -i out/film.mp4 -frames:v 1 <png>`): six
   per shot, spread over its length, and the last frame and first frame on each side of every cut. Tile them into
   sheets (`review/sheet_<shot>.jpg`, `review/cuts_<n>.jpg`) and open every sheet. Open any frame that looks wrong
   at 100%.
4. For a shot where something moves fast, a strip: `reel stills film.json --from A --to B --every 0.1`.
5. For loudness at the cuts, use the `reel cuts` report.

## What to check

**Facts.** Every name, number and date on screen against `content.json`. A caption that sits under the next
label so it reads as that label's fact is a fact error. A paraphrase must stay true to its source. Count: items in
the dataset for the film's span, items shown, items missing, and why each missing one was left out.

**The AI-tell check** (`video/handmade.md`, section 3), on the frames you opened:
1. Is any surface a flat or perfectly smooth default material?
2. Are any two repeated things identical?
3. Is any edge mathematically perfect where a hand would have cut it?
4. Is the light a sky gradient and bloom rather than a real source with a position?
5. Does the motion glide between poses? Does the camera glide?
6. Could this set belong to any other film?
7. Is there at least one thing in frame that shows how it was built?
8. Can you see every face at the beat that is about faces?
9. Do the bright things still have their colour, or have they gone white?
Apply it to the overlay too: the same label box at the same place and time in every shot reads as a template.

**Picture faults.** Frames whose brightness jumps (a light going out, a black foreground), labels over subjects
or over each other, words too small at phone size, things passing through each other, a cut with a large jump in
brightness or position that the story does not explain, focus on the wrong thing, clipped whites.

**Film.** Is the one idea clear in the first ten seconds and still at the end? Does each shot earn its seconds?
Is there a moment a viewer would remember? Is the ending a frame that works as a poster? Does the film differ
from the ledger's recent entries, or is it the series the owner asked for?

**Sound, as numbers.** Integrated loudness, true peak, and the momentary jump at each cut from `reel cuts`. You
cannot hear it; say so.

## How to write a finding

Rank by harm to a viewer watching once. Each finding has: the shot, film time and poses; what you observed with a
number where one exists; how sure you are; and one class.

| Class | Means | Write |
|---|---|---|
| `SPEC` | Fixed in the plan or the side files and a re-assembly: label side, offset, timing, wording, a cue, a hold | the file and the change |
| `RERENDER` | Fixed only in Blender: name the shot and the poses, and what to find first | `RERENDER C3 poses 13-19 and 33-37: find what switches off the warm lamp near the landings at 13 and 29` |
| `LEAVE` | Real, but not worth its cost now, or a matter of taste | why, and what it would cost |

A re-render of a whole shot is a cost of tens of minutes and a few hundred thousand tokens; say when a cheaper
`SPEC` change gets most of the way (holding a pose longer, staggering labels).

## The report: `review/REVIEW.md`

```markdown
# Review: <film file>, <duration>
Reviewer: independent critic, not one of the makers (if the session that made the film did this review, write instead: NOT independent, made by the same session; the owner's own viewing is the only outside check). Reviewed from frames and measurements. <n> images opened.

## Verdict
Ship, or fix first, and why in three sentences: would it hold a viewer, does it look made, what harms it most.

## Findings, ranked by harm
1. **<shot>, <film time> (poses a-b): <what>.** Observation with numbers. How sure. **CLASS:** the change.

## Facts
Mismatches, or "none found", then the counts.

## Measured
The gate table and the cut report as you ran them.

## Not checked
What you could not judge: rhythm at full speed, the sound, motion between the frames you opened,
pass-throughs you suspected. Say it plainly; someone must watch and listen.
```

At most twelve findings. If nothing would matter to a viewer, say "ship" and do not invent findings. On a second
review, look only at the shots that changed and at the cuts on either side of them.
