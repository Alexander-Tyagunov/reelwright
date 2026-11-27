"""Plan-driven film work with no look in it: build a shot, preview it, check it, render it, export its tracks.

A film registers once (its look, its per-shot builders, where its project folder is) and then an animator makes
the same calls for every shot, in this order:

    film.register("pd", project, plan, look, builders)       once per Blender session, after reloading the film's
    modules
    film.build_shot("S1")                                    rebuild the live scene for one shot from nothing
    film.strip([1, 8, 16, 24], "s1")                         live preview strip, under a minute
    film.submit_check("S1", [1, 12, 24])                     three poses at final settings through the render queue
    film.submit("S1")                                        save the shot's own .blend, queue the final render
    film.export_tracks("S1")                                 plates/S1/tracks.json (live scene must be that shot)
    film.status()                                            every queued job, when the queue empties, free disk

A second format of the plan is the same calls with `fmt`: build_shot("S1", fmt="9:16"), submit("S1", fmt="9:16").
Its plate goes to plates/S1@9x16/ (the first format of the plan keeps plates/S1/). A shot that names a `plate` folder
in the plan uses that folder, with the same suffix, exactly as the engine does.

The contract of every film: each live call ends under 60 s (strips of six poses or fewer; slow renders go to the
queue), each queued job reads its own saved .blend, every key is constant (stop motion: one pose is one scene
frame), every irregularity comes from a fixed seed, and the focus distance of a pose is the harmonic mean of the
nearest and farthest depth of the shot's in-focus points, smoothed over three poses.

This module only names the public calls; each job lives in a module of its own:

    plan          reading the plan (no bpy)              film_state    the registry, `Look`, `register`
    film_camera   camera and focus                       film_shot     `Shot`, `build_shot`, `layout`
    film_queue    paths, strip, tracks, saved .blend, render queue, status
"""
from .film_camera import build_camera  # noqa: F401
from .film_queue import (blend_path, disk_free_mb, export_tracks, plate_dir, save_shot, status, strip,  # noqa: F401
                         submit, submit_check)
from .film_shot import Shot, build_shot, layout  # noqa: F401
from .film_state import STATE, Look, register  # noqa: F401
from .plan import (DEFAULT_FORMATS, plan_formats, plan_fps, plan_shots, shot_camera, shot_events,  # noqa: F401
                   shot_focus_pull, shot_in_focus, shot_poses, shot_tracks)
