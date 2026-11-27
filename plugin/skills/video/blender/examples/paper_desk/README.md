# paper_desk: an example of structure

This folder shows how a film is laid out on `reel_blender`. It is not a house style: the paper-craft look, the dark
room and the blue clip lamp belong to one film, and a new film develops its own look and replaces `look.py`.
It is reduced from the first Blender film, and its first shot is that film's intro shot with names made neutral.

| File | Holds |
|---|---|
| `look.py` | The one module with taste: palette, materials, world, lights, finishing (`DEVELOP`) and the final-render overrides (`FINAL`). `register()` hands it to `film.py` |
| `shots.py` | The set pieces and one builder per shot (`BUILDERS`), and the per-shot parameters (`PARAMS`) |
| `plan/shots.json` | Three shots, two formats (16:9 and 9:16), a camera per format for the first shot, tracks, events, labels, cues |
| `assets/tag.png` | The lettering of the tag, made by `lettering.hand_lettering` (see below) |

The shots: `S1` a work lamp flickers on over a lettered tag (24 poses), `S2` a flat sheet rolls itself up (14),
`S3` two lamps in a doorway are lit one after the other (30). They share one set (`shots.set_up`).

## Run it

Copy `look.py`, `shots.py` and `assets/` to `<project>/scripts/` and `plan/` to `<project>/plan/`, on the machine where
Blender runs, and send this through the tool that runs Python in Blender (`<lib>` is the folder that holds
`reel_blender`):

```python
import bpy, sys, importlib
for p in ("<lib>", "<project>/scripts"):
    if p not in sys.path: sys.path.insert(0, p)
import reel_blender; reel_blender = importlib.reload(reel_blender); reel_blender.reload_all()
from reel_blender import film
import look, shots; importlib.reload(look); S = importlib.reload(shots)
look.register("pd", "<project>", "<project>/plan/shots.json", S.BUILDERS, S.PARAMS)
film.build_shot("S1")                      # one second or less
film.strip([1, 8, 16, 24], "s1")           # preview strip
film.submit_check("S1", [1, 12, 22])       # three poses at final settings, through the render queue
film.build_shot("S1", fmt="9:16")          # the same shot in the vertical format, its own camera from the plan
film.export_tracks("S1", fmt="9:16")       # plates/S1@9x16/tracks.json
```

The lettering is made in the workspace, not in Blender (it needs Pillow and a font file):

```python
from reel_blender import lettering
lettering.hand_lettering("assets/tag.png", "<handwriting font>.woff2", (108, 54),
    [("Every model so far", 10.15, 15.4, 31.2, 1.7, 0.45), ("March 2023 > today", 6.5, 25.0, 13.0, -0.5, 0.3)],
    px_per_mm=2048 / 108.0, seed=2303)
```
