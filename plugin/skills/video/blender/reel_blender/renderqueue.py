"""A render queue on one machine: jobs run strictly one at a time, in submission order, whoever submits them.

Several sessions (or several people) can call submit(); every job has its own saved .blend, frame list, output
folder and finishing options. One detached runner process per queue folder takes the jobs in number order and
starts a background Blender for each (`_bg_worker.py`, the same worker as background.render_background), so a
job writes the usual render_progress.json and render.log in its output folder. Nothing here needs the live
session to stay open. Files in <queue_dir>:
  jobs/0001.json    the job as submitted (never rewritten)
  jobs/0001.state   {"state": queued | rendering | done | error | cancelled, ...} written by the runner
  runner.lock       pid of the running runner; runner.log its log
No bpy at import time: status() and cancel() also work from a plain Python.
"""
import glob
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))


def _read(path, default=None):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return default


def _write(path, data):
    tmp = "%s.%d.tmp" % (path, os.getpid())
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    os.replace(tmp, path)


def alive(pid):
    """True if a process with this pid exists."""
    try:
        os.kill(int(pid), 0)
        return True
    except PermissionError:
        return True
    except Exception:
        return False


def job_ids(queue_dir):
    return sorted(int(os.path.basename(p)[:-5]) for p in glob.glob(os.path.join(queue_dir, "jobs", "[0-9]*.json")))


def job_path(queue_dir, n, ext="json"):
    return os.path.join(queue_dir, "jobs", "%04d.%s" % (n, ext))


def submit(queue_dir, name, blend, out_dir, frames=None, frame_start=None, frame_end=None, preset="cycles_final",
           overrides=None, develop=None, first=1, frame_pattern="frames/%04d.jpg", quality=95, resume=True,
           sheet=None, sheet_cols=3, start=True, blender=None):
    """Add a job to the queue and make sure a runner is working on it. Returns at once.

    blend: a saved .blend that belongs to this job alone (save a copy per job: the worker reads the file when
    the job starts, which may be an hour later). frames: list of scene frames, or frame_start..frame_end.
    Files are written to out_dir/<frame_pattern % n>, n = first + frame - frame_start (frame_start defaults to
    the smallest frame). preset / overrides: render.apply_preset. develop: dict for photo.develop per frame.
    resume=True skips frames already on disk, so a job that was interrupted can be submitted again.
    Returns dict(id, name, total, position, runner)."""
    queue_dir, out_dir, blend = os.path.abspath(queue_dir), os.path.abspath(out_dir), os.path.abspath(blend)
    if not os.path.isfile(blend):
        raise FileNotFoundError("save the .blend before submitting: " + blend)
    frames = [int(f) for f in frames] if frames else list(range(int(frame_start), int(frame_end) + 1))
    fs = int(frame_start) if frame_start is not None else min(frames)
    os.makedirs(os.path.join(queue_dir, "jobs"), exist_ok=True)
    os.makedirs(os.path.dirname(os.path.join(out_dir, frame_pattern % first)), exist_ok=True)
    job = {"name": name, "blend": blend, "submitted": time.time(), "lib_parent": os.path.dirname(HERE),
           "out_dir": out_dir, "frame_start": fs, "frame_end": max(frames), "frames": frames, "preset": preset,
           "overrides": overrides or {}, "first": int(first), "frame_pattern": frame_pattern, "quality": int(quality),
           "resume": bool(resume), "develop": develop, "sheet": sheet, "sheet_cols": int(sheet_cols),
           "progress": os.path.join(out_dir, "render_progress.json"), "log": os.path.join(out_dir, "render.log")}
    tmp = os.path.join(queue_dir, "jobs", "submit.%d.%d.tmp" % (os.getpid(), int(time.time() * 1000)))
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(job, fh, indent=1)
    ids = job_ids(queue_dir)
    n = (ids[-1] if ids else 0) + 1
    while True:  # a hard link appears whole or not at all, and fails if another session took the number
        try:
            os.link(tmp, job_path(queue_dir, n))
            break
        except FileExistsError:
            n += 1
    os.remove(tmp)
    _write(job["progress"], {"state": "queued", "done": 0, "total": len(frames), "job": n})
    runner = ensure_runner(queue_dir, blender) if start else None
    ahead = [j for j in status(queue_dir)["jobs"] if j["id"] < n and j["state"] in ("queued", "rendering")]
    return {"id": n, "name": name, "total": len(frames), "position": len(ahead) + 1, "runner": runner}


def ensure_runner(queue_dir, blender=None):
    """Start the queue's runner unless one is alive. Returns dict(pid, started)."""
    queue_dir = os.path.abspath(queue_dir)
    lock = _read(os.path.join(queue_dir, "runner.lock"), {})
    if lock.get("pid") and alive(lock["pid"]):
        return {"pid": lock["pid"], "started": False}
    if blender is None:
        import bpy
        blender = bpy.app.binary_path
    runner = os.path.join(HERE, "_queue_runner.py")
    py = sys.executable or ""
    if os.path.isfile(py) and os.path.basename(py).lower().startswith("python"):
        cmd = [py, runner, queue_dir, blender]          # Blender's own Python: no second Blender just to wait
    else:
        cmd = [blender, "--background", "--python", runner, "--", queue_dir, blender]
    log = open(os.path.join(queue_dir, "runner.log"), "a", encoding="utf-8")
    proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
    return {"pid": proc.pid, "started": True}


def status(queue_dir, sec_per_frame=18.0):
    """Every job and its state, in submission order, with an estimate of when the queue will be empty.

    sec_per_frame: used for jobs that have not rendered a frame yet (the last measured value replaces it).
    Returns dict(runner, jobs=[dict(id, name, state, done, total, sec_per_frame, eta_sec, out_dir, error)],
    eta_sec, ends_at (local clock time))."""
    queue_dir = os.path.abspath(queue_dir)
    lock = _read(os.path.join(queue_dir, "runner.lock"), {})
    jobs, spf, eta = [], float(sec_per_frame), 0.0
    for n in job_ids(queue_dir):
        job = _read(job_path(queue_dir, n))
        if job is None:
            continue
        st = _read(job_path(queue_dir, n, "state"), {"state": "queued"})
        pr = _read(job["progress"], {}) if st["state"] != "queued" else {}
        total = len(job["frames"])
        done = total if st["state"] == "done" else int(pr.get("done", 0)) if pr.get("job", n) == n else 0
        if pr.get("sec_per_frame"):
            spf = float(pr["sec_per_frame"])
        left = (total - done) * spf if st["state"] in ("queued", "rendering") else 0.0
        eta += left
        jobs.append({"id": n, "name": job["name"], "state": st["state"], "done": done, "total": total,
                     "sec_per_frame": pr.get("sec_per_frame"), "eta_sec": round(left), "out_dir": job["out_dir"],
                     "error": st.get("error") or pr.get("error")})
    return {"runner": lock.get("pid") if lock.get("pid") and alive(lock["pid"]) else None, "jobs": jobs,
            "eta_sec": round(eta), "ends_at": time.strftime("%H:%M", time.localtime(time.time() + eta))}


def cancel(queue_dir, job_id):
    """Take a job that has not started out of the queue. Returns its state afterwards."""
    path = job_path(os.path.abspath(queue_dir), int(job_id), "state")
    st = _read(path, {"state": "queued"})
    if st["state"] == "queued":
        st = {"state": "cancelled", "at": time.time()}
        _write(path, st)
    return st
