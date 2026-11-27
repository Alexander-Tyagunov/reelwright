"""One shot: the `Shot` a builder receives, `build_shot`, and the `layout` check of track positions (needs Blender)."""
import time

import bpy

from . import anim as A, project as PJ, tracks as T
from . import plan as PL
from .film_camera import build_camera
from .film_state import STATE, check_open_file, film_data, format_key


class Shot:
    """What a shot's builder receives: the plan entry (spec), parameters (p), format, scene, collections, materials,
    pose numbers (FR, 1..poses), pose times in seconds (times) and the registries the camera and the track export
    read: points (track name -> empty), cast, lamps, lights (free to use; film.py only reads `points`)."""

    def __init__(self, shot_id, p, fmt):
        f = film_data()
        self.id, self.spec, self.p, self.fmt = shot_id, f["shots"][shot_id], p, format_key(fmt)
        self.size = f["formats"][self.fmt]
        self.fps = f["fps"]
        self.poses = PL.shot_poses(self.spec)
        self.FR = list(range(1, self.poses + 1))
        self.times = [(q - 1) / float(self.fps) for q in self.FR]
        self.scene = bpy.context.scene
        self.points, self.cast, self.lamps, self.lights = {}, {}, {}, {}

    def start(self):
        """Clean scene, units, size of the format, materials, collections and world."""
        look, p = film_data()["look"], self.p
        PJ.clean_scene(self.scene)
        self.applied = PJ.setup_scene(self.scene, self.fps, self.size[0], self.size[1], 1, self.poses,
                                      look=p.get("view_look"), exposure=p.get("exposure", 0.0),
                                      dither=p.get("dither", 1.0))
        self.env, self.chars, self.trk = (PJ.collection("%s_%s" % (look.prefix, k)) for k in ("Set", "Cast", "Tracks"))
        self.mats = look.materials(p)
        look.world(self)

    def held(self, fn):
        """fn(t) sampled at every pose time (seconds)."""
        return [fn(t) for t in self.times]

    def switch(self, ob, first, last=None):
        """Show an object (or rig root) only on poses first..last by keying its scale 0 / 1 (constant keys)."""
        last = self.poses if last is None else last
        A.bake_vec(ob, "scale", self.FR, [(1.0,) * 3 if first <= q <= last else (0.0,) * 3 for q in self.FR],
                   "CONSTANT")


def build_shot(shot_id, overrides=None, fmt=None, force=False):
    """Rebuild the live scene for one shot, in one format, from nothing (a second or two). `overrides` replaces
    entries of the shot's parameters (look.params, then shot_params[shot_id], then these).

    Refuses with RuntimeError when the open file has unsaved changes and is not one of this film's shot files, because
    the build empties the open scene in memory; `force=True` builds anyway (only when the owner agreed).

    Returns a report: seconds, objects, focus_m (nearest and farthest focus distance), tracks_missing (plan tracks the
    builder did not register) and layout (screen position of each track point at six poses, see `layout`)."""
    f, t0 = film_data(), time.time()
    if shot_id not in f["shots"]:
        raise KeyError("shot %r is neither in the plan nor an extra shot (have %s)" % (shot_id, sorted(f["shots"])))
    check_open_file(bpy.data.filepath, bpy.data.is_dirty, force)
    p = dict(f["look"].params)
    p.update(f["shot_params"].get(shot_id, {}))
    p.update(overrides or {})
    sh = Shot(shot_id, p, fmt)
    sh.start()
    f["look"].lights(sh)
    f["builders"][shot_id](sh)
    build_camera(sh)
    STATE.clear()
    STATE.update(id=shot_id, fmt=sh.fmt, sh=sh, scene=sh.scene, cam=sh.cam)
    sh.scene.frame_set(1)
    n = sh.poses
    return {"shot": shot_id, "format": sh.fmt, "seconds": round(time.time() - t0, 1), "objects": len(bpy.data.objects),
            "focus_m": [round(min(sh.dfoc), 3), round(max(sh.dfoc), 3)],
            "tracks_missing": [t for t in PL.shot_tracks(sh.spec) if t not in sh.points],
            "layout": layout(sorted({max(1, q) for q in (1, n // 5, 2 * n // 5, 3 * n // 5, 4 * n // 5, n)}))}


def layout(poses):
    """Screen x, y (0..1 from the top-left), visibility and depth (m) of the shot's track points at some poses, without
    rendering: one string "x,y,visible,depth" per pose and point."""
    sh = STATE["sh"]
    d = T.sample_points(sh.scene, sh.cam, {n: sh.points[n] for n in PL.shot_tracks(sh.spec) if n in sh.points}, poses)
    out = {n: " ".join("%.2f,%.2f,%d,%.2f" % (v["x"][i], v["y"][i], v["visible"][i], v["depth"][i])
                       for i in range(len(poses)))
           for n, v in d.items()}
    out["poses"] = list(poses)
    return out
