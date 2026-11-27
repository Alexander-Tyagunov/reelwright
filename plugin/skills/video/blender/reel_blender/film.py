"""Plan-driven film work with no look in it: build a shot, preview it, check it, render it, export its tracks.

A film registers once (its look, its per-shot builders, where its project folder is) and then an animator makes
the same calls for every shot, in this order:

    film.register("pd", project, plan, look, builders)       once per Blender session, after reloading the film's modules
    film.build_shot("S1")                                    rebuild the live scene for one shot from nothing
    film.strip([1, 8, 16, 24], "s1")                         live preview strip, under a minute
    film.submit_check("S1", [1, 12, 24])                     three poses at final settings through the render queue
    film.submit("S1")                                        save the shot's own .blend, queue the final render
    film.export_tracks("S1")                                 plates/S1/tracks.json (live scene must be that shot)
    film.status()                                            every queued job, when the queue empties, free disk

A second format of the plan is the same calls with `fmt`: build_shot("S1", fmt="9:16"), submit("S1", fmt="9:16").
Its plate goes to plates/S1@9x16/ (the first format of the plan keeps plates/S1/).

What stays the same for every film, as seven animators proved: every live call ends under 60 s (strips of six poses
or fewer; slow renders go to the queue), each queued job reads its own saved .blend, every key is constant (stop
motion: one pose is one scene frame), every irregularity comes from a fixed seed, and the focus distance of a pose
is the harmonic mean of the nearest and farthest depth of the shot's in-focus points, smoothed over three poses.

The plan is read only through the accessors in the first section. Pose p is scene frame p; the plan's fps is the
rate of poses (12 for stop motion).
"""
import os
import shutil
import time

import bpy
from mathutils import Vector

from . import anim as A, camera as C, craft as K, project as PJ, render as R, renderqueue as Q, tracks as T

DEFAULT_FORMATS = {"16:9": [1920, 1080]}
STATE = {}
_FILM = {}


# ---------------------------------------------------------------- the plan: every field film.py reads
def plan_shots(plan):
    """{shot id: shot entry} from plan['sequences'][*]['shots'][*]. The one place the nesting is known."""
    return {s["id"]: s for q in plan["sequences"] for s in q["shots"]}


def plan_formats(plan):
    """{ratio: (width, height)} from plan['formats'] (pixels), in the plan's order; the first is the main format."""
    return {k: tuple(v) for k, v in (plan.get("formats") or DEFAULT_FORMATS).items()}


def plan_fps(plan, default=12):
    """Poses per second from plan['fps_poses']."""
    return int(plan.get("fps_poses", default))


def shot_poses(spec):
    """Number of poses of a shot: spec['poses']."""
    return int(spec["poses"])


def shot_tracks(spec):
    """Names of the points exported to tracks.json: spec['tracks'] (may be empty)."""
    return list(spec.get("tracks", []))


def shot_events(spec):
    """[(name, pose)] from spec['events'] (each {'name', 'pose'}); written to tracks.json as frame = pose - 1."""
    return [(e["name"], int(e["pose"])) for e in spec.get("events", [])]


def shot_in_focus(spec):
    """Names of the points the focus follows: spec['in_focus']."""
    return list(spec.get("in_focus", []))


def shot_focus_pull(spec):
    """(first pose, last pose, point name) of a hand focus pull from spec['focus_pull'] = {'poses': [a, b], 'to': name}, or None."""
    fp = spec.get("focus_pull")
    return (int(fp["poses"][0]), int(fp["poses"][1]), fp["to"]) if fp else None


def shot_camera(spec, fmt=None):
    """The camera dict of a shot for a format: spec['camera'] with the entries of spec['camera']['formats'][fmt] on top.

    Entries: lens_mm, fstop, pos, aim (metres), and for a pushed move pos_start, aim_start, moves = [[first pose, last pose]]."""
    cam = dict(spec["camera"])
    per_format = cam.pop("formats", None) or {}
    cam.update(per_format.get(fmt, {}))
    return cam


# ---------------------------------------------------------------- registry
class Look:
    """What a film registers about its look. Nothing here is the library's: the film owns every value.

    materials(p) -> {key: material}: the film's materials for a shot with parameters p.
    world(sh): create the world (the room light) for a shot.
    lights(sh): create the shot's lights (they may bake their own energy).
    params: shared shot parameters (lens, fstop, exposure, view_look, dither, ...); a shot's own dict goes on top.
    develop: dict for photo.develop on every rendered frame, or None. final: overrides of the cycles_final preset.
    prefix: names of the collections (<prefix>_Set, <prefix>_Cast, <prefix>_Tracks)."""

    def __init__(self, materials, world, lights, params, develop=None, final=None, prefix="Film"):
        self.materials, self.world, self.lights = materials, world, lights
        self.params, self.develop, self.final, self.prefix = dict(params), develop, dict(final or {}), prefix


def register(name, project, plan, look, builders, shot_params=None, extra_shots=None):
    """Register a film for this session (call it again after reloading the film's modules).

    name: short prefix of its files. project: folder with plates/, renders/, blends/, render_queue/ (created as needed).
    plan: the plan as a dict, or the path of its json. look: a Look. builders: {shot id: fn(sh)} that build the set
    pieces in view, bake the animation and register the track points in sh.points. shot_params: {shot id: dict} that
    go on top of look.params. extra_shots: {shot id: spec} for shots that are not in the plan (an intro): same shape
    as a plan entry. Returns the shot ids it can build."""
    if isinstance(plan, str):
        import json
        with open(plan) as fh:
            plan = json.load(fh)
    shots = plan_shots(plan)
    shots.update(extra_shots or {})
    _FILM.clear()
    _FILM.update(name=name, project=project, plan=plan, look=look, builders=dict(builders), shots=shots,
                 formats=plan_formats(plan), fps=plan_fps(plan), shot_params=dict(shot_params or {}))
    STATE.clear()
    return sorted(shots)


def _film():
    if not _FILM:
        raise RuntimeError("no film registered: call film.register(...) first")
    return _FILM


def _fmt(fmt):
    """The format key to use: the main format of the plan when fmt is None."""
    formats = _film()["formats"]
    key = fmt or next(iter(formats))
    if key not in formats:
        raise KeyError("format %r is not in the plan (it has %s)" % (key, sorted(formats)))
    return key


def _suffix(fmt):
    """'' for the main format, '@9x16' for a second one: the folder and file suffix."""
    key = _fmt(fmt)
    return "" if key == next(iter(_film()["formats"])) else "@" + key.replace(":", "x")


# ---------------------------------------------------------------- one shot
class Shot:
    """What a shot's builder receives: the plan entry (spec), parameters (p), format, scene, collections, materials,
    pose numbers (FR, 1..poses), pose times in seconds (times) and the registries the camera and the track export
    read: points (track name -> empty), cast, lamps, lights (free to use; film.py only reads `points`)."""

    def __init__(self, shot_id, p, fmt):
        f = _film()
        self.id, self.spec, self.p, self.fmt = shot_id, f["shots"][shot_id], p, _fmt(fmt)
        self.size = f["formats"][self.fmt]
        self.fps = f["fps"]
        self.poses = shot_poses(self.spec)
        self.FR = list(range(1, self.poses + 1))
        self.times = [(q - 1) / float(self.fps) for q in self.FR]
        self.scene = bpy.context.scene
        self.points, self.cast, self.lamps, self.lights = {}, {}, {}, {}

    def start(self):
        """Clean scene, units, size of the format, materials, collections and world."""
        look, p = _film()["look"], self.p
        PJ.clean_scene(self.scene)
        self.applied = PJ.setup_scene(self.scene, self.fps, self.size[0], self.size[1], 1, self.poses,
                                      look=p.get("view_look"), exposure=p.get("exposure", 0.0), dither=p.get("dither", 1.0))
        self.env, self.chars, self.trk = (PJ.collection("%s_%s" % (look.prefix, k)) for k in ("Set", "Cast", "Tracks"))
        self.mats = look.materials(p)
        look.world(self)

    def held(self, fn):
        """fn(t) sampled at every pose time (seconds)."""
        return [fn(t) for t in self.times]

    def switch(self, ob, first, last=None):
        """Show an object (or rig root) only on poses first..last by keying its scale 0 / 1 (constant keys)."""
        last = self.poses if last is None else last
        A.bake_vec(ob, "scale", self.FR, [(1.0,) * 3 if first <= q <= last else (0.0,) * 3 for q in self.FR], "CONSTANT")


def build_shot(shot_id, overrides=None, fmt=None):
    """Rebuild the live scene for one shot, in one format, from nothing (a second or two). `overrides` replaces
    entries of the shot's parameters (look.params, then shot_params[shot_id], then these).

    Returns a report: seconds, objects, focus_m (nearest and farthest focus distance), tracks_missing (plan tracks the
    builder did not register) and layout (screen position of each track point at six poses, see `layout`)."""
    f, t0 = _film(), time.time()
    if shot_id not in f["shots"]:
        raise KeyError("shot %r is neither in the plan nor an extra shot (have %s)" % (shot_id, sorted(f["shots"])))
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
            "tracks_missing": [t for t in shot_tracks(sh.spec) if t not in sh.points],
            "layout": layout(sorted({1, max(1, n // 5), 2 * n // 5, 3 * n // 5, 4 * n // 5, n}))}


def layout(poses):
    """Screen x, y (0..1 from the top-left), visibility and depth (m) of the shot's track points at some poses, without
    rendering: one string "x,y,visible,depth" per pose and point."""
    sh = STATE["sh"]
    d = T.sample_points(sh.scene, sh.cam, {n: sh.points[n] for n in shot_tracks(sh.spec) if n in sh.points}, poses)
    out = {n: " ".join("%.2f,%.2f,%d,%.2f" % (v["x"][i], v["y"][i], v["visible"][i], v["depth"][i]) for i in range(len(poses)))
           for n, v in d.items()}
    out["poses"] = list(poses)
    return out


# ---------------------------------------------------------------- camera and focus
def build_camera(sh):
    """Camera of the plan for the shot's format: locked off, or pushed by hand over the poses in `moves`; lens and
    f-stop from the plan (parameters lens, fstop, cam_pos, cam_aim override), clip 2 cm to 30 m. Focus: per pose the
    harmonic mean of the nearest and farthest depth among the in-focus points that are visible, smoothed over three
    poses. A focus pull (plan or parameter `focus_pull`) ends on its point. Sets sh.cam and sh.dfoc (m per pose)."""
    c, p, n = shot_camera(sh.spec, sh.fmt), sh.p, sh.poses
    pos1, aim1 = tuple(p.get("cam_pos", c["pos"])), tuple(p.get("cam_aim", c["aim"]))
    pos0, aim0 = tuple(c.get("pos_start", pos1)), tuple(c.get("aim_start", aim1))
    cam = C.make_camera("%s_Camera" % _film()["look"].prefix, p.get("lens", c.get("lens_mm", 40.0)), clip=(0.02, 30.0),
                        collection=sh.trk, scene=sh.scene)
    tgt = C.make_empty("%s_CamTarget" % _film()["look"].prefix, aim0, sh.trk, size=0.01)
    foc = C.make_empty("%s_Focus" % _film()["look"].prefix, (0.0, 0.0, 0.02), sh.trk, size=0.01)
    C.aim_at(cam, tgt)
    moves = c.get("moves") or []
    prog = K.hand_slide(5, n, moves[0][0] - 1, moves[0][1] - 1, 0.3) if moves else [1.0] * n
    moving = [0.0 < prog[i] < 1.0 or (i > 0 and prog[i] != prog[i - 1]) for i in range(n)]
    C.slider(cam, sh.FR, pos0, pos1, prog, K.pose_jitter(6, n, 0.00012, 0.0, moving))
    C.slider(tgt, sh.FR, aim0, aim1, prog, K.pose_jitter(7, n, 0.0004, 0.0, moving))
    pull = shot_focus_pull(sh.spec) if "focus_pull" not in p else p["focus_pull"]
    pull = pull if (pull and pull[2] in sh.points) else None
    names = [k for k in p.get("in_focus", shot_in_focus(sh.spec)) if k in sh.points and not (pull and k == pull[2])]
    dfoc = _focus_distances(sh, cam, {k: sh.points[k] for k in names})
    if pull:
        far = T.sample_points(sh.scene, cam, {pull[2]: sh.points[pull[2]]}, sh.FR)[pull[2]]["depth"]
        turn = K.hand_slide(8, n, pull[0] - 1, pull[1] - 1, 0.3)
        dfoc = [1.0 / ((1.0 - u) / a + u / b) for a, b, u in zip(dfoc, far, turn)]
    fpos = []
    for i, q in enumerate(sh.FR):
        sh.scene.frame_set(q)
        mw = cam.matrix_world
        w = mw.translation + (mw.to_quaternion() @ Vector((0.0, 0.0, -1.0))) * dfoc[i]
        fpos.append((w[0], w[1], w[2]))
    A.bake_vec(foc, "location", sh.FR, fpos, "CONSTANT")
    C.set_dof(cam, foc, fstop=p.get("fstop", c.get("fstop", 16.0)))
    C.lens_character(cam, blades=7, rotation=0.4)
    sh.cam, sh.dfoc = cam, dfoc
    return cam


def _focus_distances(sh, cam, subjects):
    """Focus distance (m) per pose for the subject points: harmonic mean of nearest and farthest visible depth."""
    dep = T.sample_points(sh.scene, cam, subjects, sh.FR)
    out = []
    for i in range(sh.poses):
        ds = ([dep[k]["depth"][i] for k in subjects if dep[k]["visible"][i]]
              or [dep[k]["depth"][i] for k in subjects if dep[k]["depth"][i] > 0.05] or [0.5])
        lo, hi = min(ds), max(ds)
        out.append(2.0 * lo * hi / (lo + hi))
    return [sum(out[max(0, i - 1):i + 2]) / len(out[max(0, i - 1):i + 2]) for i in range(len(out))]


# ---------------------------------------------------------------- paths, previews, tracks, renders
def _need(shot_id, fmt=None):
    if STATE.get("id") != shot_id or STATE.get("fmt") != _fmt(fmt):
        raise RuntimeError("the live scene holds %s (%s); call build_shot(%r, fmt=%r) first"
                           % (STATE.get("id"), STATE.get("fmt"), shot_id, _fmt(fmt)))
    return STATE["sh"]


def blend_path(shot_id, fmt=None):
    """The shot's own file: <project>/blends/<name>-<shot>[@fmt].blend."""
    f = _film()
    return "%s/blends/%s-%s%s.blend" % (f["project"], f["name"], shot_id, _suffix(fmt))


def plate_dir(shot_id, fmt=None):
    """The shot's plate folder: <project>/plates/<shot>, or <shot>@9x16 for a second format."""
    return "%s/plates/%s%s" % (_film()["project"], shot_id, _suffix(fmt))


def disk_free_mb(path=None):
    """Free space (MB) on the disk that holds the project folder (or `path`). Check it before queuing and report it."""
    path = path or _film()["project"]
    os.makedirs(path, exist_ok=True)
    return shutil.disk_usage(path).free // 1048576


def _guard(min_free_mb):
    free = disk_free_mb()
    if free < min_free_mb:
        raise RuntimeError("only %d MB free on the Blender machine (limit %d): free some space before queuing" % (free, min_free_mb))
    return free


def strip(poses, name, cols=3, preset="cycles_preview", **over):
    """Live preview strip of the shot in the scene: renders/preview/<name>.jpg. Keep poses x seconds under a minute."""
    f = _film()
    return R.render_strip(STATE["scene"], list(poses), "%s/renders/preview/%s.jpg" % (f["project"], name),
                          preset=preset, cols=cols, develop=f["look"].develop, **over)


def export_tracks(shot_id, fmt=None):
    """Write the plate's tracks.json for the live shot: every name in the shot's tracks, its events (frame = pose - 1)."""
    sh = _need(shot_id, fmt)
    missing = [t for t in shot_tracks(sh.spec) if t not in sh.points]
    if missing:
        raise KeyError("no track point for %s" % missing)
    return T.export_tracks(sh.scene, sh.cam, {t: sh.points[t] for t in shot_tracks(sh.spec)},
                           plate_dir(shot_id, fmt) + "/tracks.json", events=shot_events(sh.spec))


def save_shot(shot_id, fmt=None):
    """Save the live scene as the shot's own file. A queued render reads that file, so later edits to the live
    scene cannot change it. Do not save it again while its job waits."""
    _need(shot_id, fmt)
    os.makedirs(os.path.dirname(blend_path(shot_id, fmt)), exist_ok=True)
    return PJ.save(blend_path(shot_id, fmt))


def submit(shot_id, fmt=None, frames=None, out_dir=None, name=None, min_free_mb=500, **over):
    """Save the shot and queue its final render (all poses, or the pose list `frames`) into its plate folder.

    Refuses when the Blender machine has less than min_free_mb free. over: overrides of the cycles_final preset on
    top of the look's. Returns the queue ticket plus free_mb."""
    f, sh = _film(), _need(shot_id, fmt)
    free = _guard(min_free_mb)
    save_shot(shot_id, fmt)
    o = dict(f["look"].final)
    o.update(over)
    tk = Q.submit(f["project"] + "/render_queue", name or shot_id + _suffix(fmt), blend_path(shot_id, fmt),
                  out_dir or plate_dir(shot_id, fmt), frames=frames, frame_start=1, frame_end=sh.poses,
                  preset="cycles_final", overrides=o, develop=f["look"].develop)
    tk["free_mb"] = free
    return tk


def submit_check(shot_id, poses, fmt=None, min_free_mb=500):
    """Queue three (or so) poses at final settings into renders/check/<shot>[@fmt]/f%04d.jpg: the sharpness and
    exposure check before a full render. The job gets a copy of the scene in a file of its own, so the shot can
    be changed, saved and submitted while the check waits. Returns the queue ticket plus free_mb."""
    f, _sh = _film(), _need(shot_id, fmt)
    free = _guard(min_free_mb)
    path = blend_path(shot_id, fmt).replace(".blend", "-check.blend")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
    tk = Q.submit(f["project"] + "/render_queue", shot_id + _suffix(fmt) + "-check", path,
                  "%s/renders/check/%s%s" % (f["project"], shot_id, _suffix(fmt)), frames=list(poses), frame_start=1,
                  preset="cycles_final", overrides=dict(f["look"].final), develop=f["look"].develop,
                  frame_pattern="f%04d.jpg", resume=False)
    tk["free_mb"] = free
    return tk


def status(sec_per_frame=18.0):
    """Every job in the film's render queue and when the queue should be empty, plus free_mb on the Blender machine."""
    st = Q.status(_film()["project"] + "/render_queue", sec_per_frame)
    st["free_mb"] = disk_free_mb()
    return st
