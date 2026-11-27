# Handover between animators

`plan/HANDOVER.md` is how a fresh animator learns what the last one built, measured and changed. Each animator
reads all earlier sections before touching Blender, and appends one section before it replies. Nobody edits an
earlier section; a correction to it is written in your own section and points back.

The file starts with one line: "Read `video/blender.md` and `video/handmade.md` first, then this." Then one
section per sequence (the sample shot has its own, first). On one machine the
two columns of the files table are the same folder; write it once.

```markdown
## After sequence <id> (<shots> built and queued)

### Files
| What | Workspace (source of truth) | Blender machine |
|---|---|---|
| look module | blender/<look>.py | <project there>/scripts/<look>.py |
| this sequence | blender/<seq>.py | <project there>/scripts/<seq>.py |
| shot files | | <project there>/blends/<name>-<shot>.blend (one per job; not saved again while its job waits) |
| plates | plates/<shot>/ (after transfer) | <project there>/plates/<shot>/ |
| check frames | renders/check/<shot>/ (staged copies) | <project there>/renders/check/<shot>/ |

### How to call it
The snippet for the Blender tool that loads the library, the look and this sequence, builds a shot, draws a
strip, submits a check and the final job, and reads the queue status. Copy it from the previous section and
change only what changed.

### Added to the shared code
Each new function with its arguments and what later sequences can use it for.

### Measured
| Shot | Poses | Objects | Lights | Seconds a pose (final) | Queue job | Notes |

### Deviations from the plan, with reasons
Every place where the plate differs from `plan/shots.json` or `plan/film-plan.md`: a moved event (old and new pose),
a label point that moves, a beat dropped. The builder reads this before assembling; an event that moved must also
be changed in the plan, and `reel plan` run again.

### Where everything stands at the end of this sequence
Each character: position, what it carries, its state (eyes, ribbon length, hat). The set: what was added, what is
lit. This is what the next sequence must match at its first pose.

### Sound cues the plan does not list
Shot, pose, kind, gain. The builder copies them into `plan/extra-cues.json`.

### For the next animator
What will catch you out: scale, light powers, things that hide each other from this camera, a function that does
not do what its name says.

### Corrections made to the references
File, section, one line on what was wrong. Make the correction in the reference itself too.
```

## What a good section has

- Numbers, not impressions: seconds per pose, watts, f-stop, the pose an event landed on.
- Every deviation, even small ones. A label that ends two poses earlier than planned fails the holds gate at
  assembly if nobody says so.
- The end state, written so the next animator can build the first pose of its sequence without opening the
  previous shot.
- What was not checked: a pass-through you suspected but did not prove, a strip you did not draw.

The worked example (a release-history film made as paper models on a desk) had five sections: four sequences and
an intro shot added after the film was finished, which rebuilt the first shot's set under that shot's own object
names so the cut into it would not jump.
