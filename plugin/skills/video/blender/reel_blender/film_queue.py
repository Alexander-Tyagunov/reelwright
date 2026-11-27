"""Files and jobs of a shot: paths, the live preview strip, tracks.json, the shot's own .blend, and the render queue
(needs Blender)."""
import os
import shutil

import bpy

from . import plan as PL
from . import project as PJ, render as R, renderqueue as Q, tracks as T
from .film_state import STATE, film_data, format_key, suffix


def _need(shot_id, fmt=None):
    """The live Shot, or RuntimeError when the live scene is another shot or format."""
    if STATE.get("id") != shot_id or STATE.get("fmt") != format_key(fmt):
        raise RuntimeError("the live scene holds %s (%s); call build_shot(%r, fmt=%r) first"
                           % (STATE.get("id"), STATE.get("fmt"), shot_id, format_key(fmt)))
    return STATE["sh"]


def blend_path(shot_id, fmt=None):
    """The shot's own file: <project>/blends/<name>-<shot>[@fmt].blend. Raises ValueError for a bad shot id."""
    f = film_data()
    return "%s/blends/%s-%s%s.blend" % (f["project"], f["name"], PL.check_shot_id(shot_id), suffix(fmt))


def plate_dir(shot_id, fmt=None):
    """The shot's plate folder, as the engine reads it: <project>/<the shot's `plate` folder, or plates/<shot>>, with
    '@9x16' added for a second format unless the folder already ends with it."""
    f = film_data()
    return "%s/%s" % (f["project"], PL.plate_folder(shot_id, f["shots"].get(shot_id, {}), suffix(fmt)))


def disk_free_mb(path=None):
    """Free space (MB) on the disk that holds the project folder (or `path`). Check it before queuing and report it."""
    path = path or film_data()["project"]
    os.makedirs(path, exist_ok=True)
    return shutil.disk_usage(path).free // 1048576


def _guard(min_free_mb):
    free = disk_free_mb()
    if free < min_free_mb:
        raise RuntimeError("only %d MB free on the Blender machine (limit %d): free some space before queuing"
                           % (free, min_free_mb))
    return free


def strip(poses, name, cols=3, preset="cycles_preview", **over):
    """Live preview strip of the shot in the scene: renders/preview/<name>.jpg. Keep poses x seconds under a minute."""
    f = film_data()
    return R.render_strip(STATE["scene"], list(poses), "%s/renders/preview/%s.jpg" % (f["project"], name),
                          preset=preset, cols=cols, develop=f["look"].develop, **over)


def export_tracks(shot_id, fmt=None):
    """Write the plate's tracks.json for the live shot: every name in the shot's tracks, its events (frame = pose
    - 1)."""
    sh = _need(shot_id, fmt)
    missing = [t for t in PL.shot_tracks(sh.spec) if t not in sh.points]
    if missing:
        raise KeyError("no track point for %s" % missing)
    return T.export_tracks(sh.scene, sh.cam, {t: sh.points[t] for t in PL.shot_tracks(sh.spec)},
                           plate_dir(shot_id, fmt) + "/tracks.json", events=PL.shot_events(sh.spec))


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
    f, sh = film_data(), _need(shot_id, fmt)
    free = _guard(min_free_mb)
    save_shot(shot_id, fmt)
    o = dict(f["look"].final)
    o.update(over)
    tk = Q.submit(f["project"] + "/render_queue", name or shot_id + suffix(fmt), blend_path(shot_id, fmt),
                  out_dir or plate_dir(shot_id, fmt), frames=frames, frame_start=1, frame_end=sh.poses,
                  preset="cycles_final", overrides=o, develop=f["look"].develop)
    tk["free_mb"] = free
    return tk


def submit_check(shot_id, poses, fmt=None, min_free_mb=500):
    """Queue three (or so) poses at final settings into renders/check/<shot>[@fmt]/f%04d.jpg: the sharpness and
    exposure check before a full render. The job gets a copy of the scene in a file of its own, so the shot can
    be changed, saved and submitted while the check waits. Returns the queue ticket plus free_mb."""
    f, _sh = film_data(), _need(shot_id, fmt)
    free = _guard(min_free_mb)
    path = blend_path(shot_id, fmt)[:-len(".blend")] + "-check.blend"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
    tk = Q.submit(f["project"] + "/render_queue", shot_id + suffix(fmt) + "-check", path,
                  "%s/renders/check/%s%s" % (f["project"], shot_id, suffix(fmt)), frames=list(poses), frame_start=1,
                  preset="cycles_final", overrides=dict(f["look"].final), develop=f["look"].develop,
                  frame_pattern="f%04d.jpg", resume=False)
    tk["free_mb"] = free
    return tk


def status(sec_per_frame=18.0):
    """Every job in the film's render queue and when the queue should be empty, plus free_mb on the Blender machine."""
    st = Q.status(film_data()["project"] + "/render_queue", sec_per_frame)
    st["free_mb"] = disk_free_mb()
    return st
