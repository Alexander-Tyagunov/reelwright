"""Export tracks.json: where named points sit on screen in every frame, for the engine's labels.

Contract (version 1): x 0..1 from the left, y 0..1 from the TOP, visible 0/1, depth in metres
along the camera axis; one value per frame; events use 0-based plate frame numbers.
"""
import json
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view


def _hidden(ob, depsgraph):
    o = ob
    while o is not None:
        if o.hide_render:
            return True
        o = o.parent
    m = ob.evaluated_get(depsgraph).matrix_world.to_3x3()
    return abs(m.determinant()) < 1e-12  # scaled to zero (the usual way to switch a rig off)


def sample_points(scene, camera, points, frames):
    """Screen positions of objects at the given scene frames.

    points: {name: object} (use empties parented to what they follow).
    Returns {name: {x, y, visible, depth}} with one value per frame.
    visible is 0 when the point is behind the camera, outside the frame, or the object
    (or a parent) is hidden from render or scaled to zero at that frame.
    """
    keep = scene.frame_current
    out = {n: {"x": [], "y": [], "visible": [], "depth": []} for n in points}
    for f in frames:
        scene.frame_set(int(f))
        dg = bpy.context.evaluated_depsgraph_get()
        for name, ob in points.items():
            co = world_to_camera_view(scene, camera, ob.evaluated_get(dg).matrix_world.translation)
            x, y, depth = co.x, 1.0 - co.y, co.z
            vis = depth > 0.0 and 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0 and not _hidden(ob, dg)
            d = out[name]
            d["x"].append(round(x, 5)); d["y"].append(round(y, 5))
            d["visible"].append(1 if vis else 0); d["depth"].append(round(depth, 4))
    scene.frame_set(keep)
    return out


def export_tracks(scene, camera, points, out_path, events=(), frame_start=None, frame_end=None,
                  first=1, frame_pattern="frames/%04d.jpg"):
    """Write tracks.json for scene frames frame_start..frame_end (default: the scene range).

    events: [(name, scene_frame)]; written 0-based relative to frame_start.
    Width / height are the full render size (resolution percentage ignored).
    """
    fs = scene.frame_start if frame_start is None else int(frame_start)
    fe = scene.frame_end if frame_end is None else int(frame_end)
    data = {
        "version": 1, "fps": int(round(scene.render.fps / scene.render.fps_base)),
        "frames": fe - fs + 1, "width": scene.render.resolution_x, "height": scene.render.resolution_y,
        "frame_pattern": frame_pattern, "first": int(first),
        "points": sample_points(scene, camera, points, range(fs, fe + 1)),
        "events": [{"name": n, "frame": int(f) - fs} for n, f in events],
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    return {"path": out_path, "frames": data["frames"], "points": sorted(points), "events": data["events"]}
