"""Worker run by background.render_background inside `blender --background`. Not imported."""
import json
import os
import sys
import time
import traceback

import bpy

job_path = sys.argv[sys.argv.index("--") + 1]
with open(job_path) as fh:
    JOB = json.load(fh)
sys.path.insert(0, JOB["lib_parent"])


def write(state, **kw):
    kw["state"] = state
    tmp = JOB["progress"] + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(kw, fh)
    os.replace(tmp, JOB["progress"])


def main():
    from reel_blender import render as rr

    scene = bpy.context.scene
    applied = rr.apply_preset(scene, JOB["preset"], **JOB["overrides"])
    frames = list(range(JOB["frame_start"], JOB["frame_end"] + 1))
    total, done, t0, times = len(frames), 0, time.time(), []
    for f in frames:
        path = os.path.join(JOB["out_dir"], JOB["frame_pattern"] % (JOB["first"] + f - JOB["frame_start"]))
        if not (JOB["resume"] and os.path.isfile(path) and os.path.getsize(path) > 0):
            t = time.time()
            scene.frame_set(f)
            rr.set_output(scene, path, JOB["quality"])
            bpy.ops.render.render(write_still=True)
            times.append(time.time() - t)
        done += 1
        steady = times[1:] or times  # the first frame includes shader compilation
        spf = sum(steady) / len(steady) if steady else 0.0
        write("rendering", done=done, total=total, frame=f, sec_per_frame=round(spf, 2),
              first_frame_sec=round(times[0], 2) if times else 0.0,
              elapsed=round(time.time() - t0, 1), eta_sec=round(spf * (total - done), 1), preset=applied)
    steady = times[1:] or times
    write("done", done=done, total=total, sec_per_frame=round(sum(steady) / len(steady), 2) if steady else 0.0,
          first_frame_sec=round(times[0], 2) if times else 0.0, elapsed=round(time.time() - t0, 1),
          eta_sec=0, preset=applied)


try:
    main()
except Exception:
    write("error", error=traceback.format_exc()[-1500:])
    raise
