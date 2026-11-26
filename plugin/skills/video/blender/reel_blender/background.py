"""Animation renders in a separate, detached Blender process with a progress file.

The live session must never render an animation: MCP calls time out after about two minutes.
render_background() returns at once; poll read_progress() or list the output folder.
"""
import json
import os
import subprocess
import time

import bpy


def render_background(blend_path, out_dir, frame_start, frame_end, preset="final", overrides=None,
                      first=1, frame_pattern="frames/%04d.jpg", quality=95, resume=False,
                      progress_path=None, log_path=None, frames=None, develop=None, sheet=None, sheet_cols=3):
    """Start `blender --background <blend> --python _bg_worker.py` for scene frames frame_start..frame_end.

    Writes out_dir/<frame_pattern % n> with n = first + (frame - frame_start), JPEG `quality` (or PNG by
    extension). preset / overrides: see render.apply_preset. resume=True skips frames already on disk.
    frames: explicit list of scene frames instead of the whole range (file number = first + frame - frame_start).
    develop: dict for photo.develop() applied to every frame (seed = frame number). sheet: path of a contact
    sheet of all frames written at the end (`sheet_cols` across): one look for a background preview.
    The .blend must be saved first: the worker reads the file, not the live session.
    Returns dict(pid, progress, log, total, dirty) immediately.
    """
    out_dir = os.path.abspath(out_dir)
    os.makedirs(os.path.dirname(os.path.join(out_dir, frame_pattern % first)), exist_ok=True)
    progress_path = progress_path or os.path.join(out_dir, "render_progress.json")
    log_path = log_path or os.path.join(out_dir, "render.log")
    job = {
        "lib_parent": os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "out_dir": out_dir, "frame_start": int(frame_start), "frame_end": int(frame_end),
        "preset": preset, "overrides": overrides or {}, "first": int(first),
        "frame_pattern": frame_pattern, "quality": int(quality), "resume": bool(resume),
        "progress": progress_path, "frames": [int(f) for f in frames] if frames else None,
        "develop": develop, "sheet": sheet, "sheet_cols": int(sheet_cols),
    }
    job_path = os.path.join(out_dir, "render_job.json")
    with open(job_path, "w") as fh:
        json.dump(job, fh, indent=1)
    with open(progress_path, "w") as fh:
        json.dump({"state": "starting", "done": 0, "total": len(frames) if frames else job["frame_end"] - job["frame_start"] + 1,
                   "started": time.time()}, fh)
    worker = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_bg_worker.py")
    cmd = [bpy.app.binary_path, "--background", blend_path, "--python", worker, "--", job_path]
    log = open(log_path, "w")
    proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                            start_new_session=True)
    return {"pid": proc.pid, "progress": progress_path, "log": log_path,
            "total": len(frames) if frames else job["frame_end"] - job["frame_start"] + 1,
            "dirty": bool(bpy.data.is_dirty), "blend": blend_path}


def read_progress(progress_path):
    """Read the worker's progress file: state (starting | rendering | done | error), done, total,
    sec_per_frame, elapsed, eta_sec, error."""
    try:
        with open(progress_path) as fh:
            return json.load(fh)
    except Exception as exc:  # missing or mid-write
        return {"state": "unknown", "error": repr(exc)}
