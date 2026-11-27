# The shot plan

A film made from rendered plates (a 3D scene, for example) is planned in one file, the shot plan. The engine reads it
with `reel plan` (checks) and `reel assemble` (writes `film.json`). The 3D side reads the same file for the camera,
the poses and the points. Each side uses its own fields and leaves the others alone: the engine checks the fields
below and passes every other field of the plan, a sequence, a shot or a label through untouched.

```
reel plan plan/shots.json                      # checks; exit 1 on a failure
reel assemble plan/shots.json --out film.json  # writes the spec
```

## Where files live

The film folder holds `film.json`, `plates/` and `plan/`. Plate folders in the plan, and `--intro` and `--outro`,
are relative to the film folder. `reel plan` and `reel assemble` find it the same way: `--root`, which defaults to the
folder above a plan folder called `plan`, else the plan's own folder. The plate paths in the spec are written relative
to the folder of `--out`. Shot ids use letters, digits, `-` and `_` only. The side files below sit beside the plan.
`reel plan` also warns when `film_fps` is not a multiple of `fps_poses` and when a plate's `fps` differs from
`fps_poses`; `reel assemble` refuses an intro or outro whose folder name is also a shot id, and a plan with no shots.

## Fields the engine reads

| Where | Field | Meaning | Default |
|---|---|---|---|
| plan | `title` | Film title; `film.json` gets `meta.title` = title and the shot ids | required |
| plan | `fps_poses` | Poses per second; a pose is one plate frame | 12 |
| plan | `film_fps` | Frame rate of the film | 24 |
| plan | `formats` | Name to `[width, height]`, first format first, e.g. `{"16:9": [1920, 1080], "9:16": [1080, 1920]}` | `{"16:9": [1920, 1080]}` |
| plan | `total_poses` | If present, must equal the sum of the shots' poses | none |
| plan | `sound.intensity` | Bed level curve, points `{at_s, value}` (seconds, 0 to 1), at least 2, rising in time | required |
| plan | `sound.engine_palette` | Engine palette name (`reel --help` lists them under `sound`) | `calm`: `reel assemble` writes `calm` into the spec when the plan names none |
| plan | `sound.auto` | `meta.sound.auto` of the spec | `{"transition": 0.35, "ending": false}` |
| plan | `sequences[].shots[]` | Shots in film order; `sequences[].id` is required | required |
| shot | `id` | Unique; the scene id and the default plate folder name | required |
| shot | `poses` | Length in poses; must equal the plate's frame count | required |
| shot | `tracks` | Names of the plate's tracks | required |
| shot | `plate` | Plate folder, relative to the film folder | `plates/<id>` |
| shot | `chapter` | Title of the video chapter that starts here; copied to the scene | none |
| shot | `labels[]` | Labels that follow a track (below) | required, may be empty |
| shot | `cues[]` | `{pose, kind, gain}`: pose from 1, kind a sound cue kind, gain above 0 to 1 | required, may be empty |
| shot | `events[]` | `{name, pose}`, pose from 1, inside the shot | `[]` |
| label | `track`, `text`, `sub` | Track to follow, first line, second line (may be empty) | required |
| label | `line` | Optional third line, shown at the foot of the frame as a free text | none |
| label | `from_pose`, `to_pose` | First and last pose on screen, counted from 1 | required |
| label | `side`, `offset`, `smooth`, `follow` | Placement, as the `plate` scene fields | `auto`, 5, 0.6, none |

Pose `p` is shown from `(p - 1) / fps_poses` to `p / fps_poses` seconds of its shot. Words are never changed by the
engine; placement can be, through the override file.

## Fields the Blender library reads

The library reads the plan only through the accessors of `reel_blender/plan.py` (`film.py` re-exports them); the engine passes these fields
through untouched. Pose numbers count from 1, as above. Distances are metres.

| Where | Field | Meaning | Default |
|---|---|---|---|
| plan | `sequences[].shots[]` | Shots by id (`plan_shots`) | required |
| plan | `formats` | Name to `[width, height]`; the first is the main format (`plan_formats`) | `{"16:9": [1920, 1080]}` |
| plan | `fps_poses` | Poses per second; pose `p` is scene frame `p` (`plan_fps`) | 12 |
| shot | `poses` | Number of poses (`shot_poses`) | required |
| shot | `tracks` | Names of the points written to `tracks.json` (`shot_tracks`) | `[]` |
| shot | `events` | `{name, pose}`; written as frame = pose - 1 (`shot_events`) | `[]` |
| shot | `in_focus` | Tracks the focus follows: harmonic mean of the nearest and farthest depth, smoothed over three poses (`shot_in_focus`) | `[]` |
| shot | `focus_pull` | `{"poses": [a, b], "to": "<track>"}`: a hand focus pull that ends on that track (`shot_focus_pull`) | none |
| shot | `camera` | A dict, below (`shot_camera`) | required |
| camera | `lens_mm`, `fstop` | Lens in millimetres, aperture | 40, 16 |
| camera | `pos`, `aim` | Camera position and the point it looks at; with `moves`, where the move ends | required |
| camera | `pos_start`, `aim_start` | Where a pushed move begins | `pos`, `aim` |
| camera | `moves` | `[[first pose, last pose]]`: the hand move from the start to the end over those poses | `[]` (locked off) |
| camera | `formats` | `{"9:16": {...}}`: entries that replace the camera's own for that format | `{}` |

Used by no code but by the people reading the plan: `releases`, `seconds`, `walkers` and any other field. The look
parameters of a film (light powers, exposure, `cam_pos` overrides) are not plan fields; they live in the film's
look module and its per-shot parameters.

## What `reel plan` checks

Schema (a failure names the path of the field); totals; events and cues inside their shots; the intensity curve;
labels inside their shots and on listed tracks; reading time of each label (`0.3 s` per word of text, sub and line
plus `0.5 s`; a failure below that, a warning without the `0.35 s` entrance); that a label's line is read before its
shot ends (warning); at most 4 labels on screen at once; and plates (warning only): the plate of every shot exists
in every format and has as many frames as the shot has poses.

## Worked example

```json
{
  "title": "Ten years of the road",
  "fps_poses": 12,
  "film_fps": 24,
  "formats": {"16:9": [1920, 1080]},
  "sound": {
    "engine_palette": "storybook",
    "intensity": [{"at_s": 0, "value": 0.1}, {"at_s": 3, "value": 0.6}]
  },
  "sequences": [{
    "id": "A",
    "shots": [{
      "id": "A1",
      "poses": 36,
      "chapter": "The first lamp",
      "tracks": ["lamp_one"],
      "labels": [{
        "track": "lamp_one", "text": "Version 1", "sub": "March 2020",
        "line": "The first release", "from_pose": 13, "to_pose": 36,
        "side": "top", "offset": 5
      }],
      "cues": [{"pose": 13, "kind": "chime", "gain": 0.4}],
      "camera": {"lens_mm": 40, "pos": [0, -1, 0.1]}
    }]
  }]
}
```

`camera` is read by the Blender library, not by the engine. The assembled scene is `{type: "plate", id: "A1", duration: 3, plate:
"plates/A1/tracks.json", chapter: "The first lamp", labels: [...], texts: [...], cues: [...]}`, with the label from 1 s
to 3 s and its `line` as a text from 1 s.

## Side files, beside the plan

| File | Shape | Use |
|---|---|---|
| `label-overrides.json` | `{"<shot id>": {"<label text>": {"side", "offset", "smooth", "follow", "variant", "from", "to", "line": {"x", "y", "from", "to", "class", "align"}}}}` | Placement and timing fixes found by `reel qa`; never words. `from` and `to` are seconds inside the shot. Wins over the plan's label fields. A warning names an override that matches no label or shortens a label below the plan |
| `extra-cues.json` | `{"<shot or plate id>": [{"pose", "kind", "gain"}]}` | Cues the animator found while building; merged with the shot's cues and sorted by pose. Also the cues of an intro or outro plate |
| `outro-texts.json` | `{"<plate id>": [{"text", "class", "x", "y", "from", "align"}]}` | Free texts of an intro or outro plate, which is not in the plan |
| `brand.json` | The `brand` block of a spec, or `{"brand": {...}}` | Colours and fonts. Without it the film has the default look |

A line (the third text) is shown from its label's start to its label's end, longer when its reading time needs it,
stacked 6 `u` upward for each line shown at the same time unless the override gives its `y`.

## Formats and plates

The first format of `formats` uses `plates/<shot>/`. Every other format uses `plates/<shot>@9x16/` (the name with `:`
written `x`). `reel assemble --format 9:16` writes that format's size and plate paths, and also reads an intro and
outro from `<folder>@9x16`. Labels keep their placement; run `reel qa` on the second film, because a different
frame needs different offsets. A shot may carry a camera per format; that field belongs to the 3D side (next section).

## Intro, outro and the sound curve

`--intro plates/A0` puts a plate before the first shot and `--outro plates/Z0` after the last; their id is the folder
name and their length comes from `tracks.json`. The bed starts at 0.02 under the intro, takes the plan's first value
when the first shot starts, and eases to 0.02 after the outro. `--shots A1,A2` builds part of the film; the curve follows
the chosen shots (each keeps its own part, also when shots between are left out). `--no-sound` leaves `meta.sound` out.
