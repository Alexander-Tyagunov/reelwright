"""Render presets, stills and contact sheets.

Measured on an Apple M1 Pro (Metal), Blender 5.3, shot-claude3 scene:
see plugin/skills/video/references/blender.md for the numbers.
Never render an animation inside a live MCP call: use background.render_background.
"""
import math
import os
import time

import bpy

PRESETS = {
    # scale: resolution percentage; samples: Eevee TAA render samples (also drives DOF and soft shadow quality)
    "preview": dict(engine="EEVEE", scale=50, samples=12, raytracing=False, shadow_rays=1, shadow_steps=4, dof_jitter=False),
    "draft": dict(engine="EEVEE", scale=50, samples=20, raytracing=True, rt_resolution="2", shadow_rays=1, shadow_steps=6, dof_jitter=True),
    "final": dict(engine="EEVEE", scale=100, samples=40, raytracing=True, rt_resolution="2", shadow_rays=2, shadow_steps=6, dof_jitter=True),
    "cycles_still": dict(engine="CYCLES", scale=100, samples=96, denoise=True),
}


def apply_preset(scene, name, **overrides):
    """Apply a preset (sticky). Any preset key can be overridden, e.g. scale=25, samples=8.

    Returns the applied values plus 'skipped': settings this Blender build did not accept.
    """
    p = dict(PRESETS[name])
    p.update(overrides)
    r, skipped = scene.render, []

    def put(obj, attr, val):
        try:
            setattr(obj, attr, val)
        except Exception:
            skipped.append(attr)

    if p["engine"] == "CYCLES":
        r.engine = "CYCLES"
        try:
            bpy.context.preferences.addons["cycles"].preferences.compute_device_type = "METAL"
        except Exception:
            skipped.append("compute_device_type")
        c = scene.cycles
        put(c, "device", "GPU")
        put(c, "samples", p["samples"])
        put(c, "use_denoising", p.get("denoise", True))
    else:
        for eid in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
            try:
                r.engine = eid
                break
            except Exception:
                continue
        e = scene.eevee
        put(e, "taa_render_samples", p["samples"])
        put(e, "use_raytracing", p["raytracing"])
        if p.get("rt_resolution"):
            put(e.ray_tracing_options, "resolution_scale", p["rt_resolution"])
        put(e, "use_shadows", True)
        put(e, "shadow_ray_count", p["shadow_rays"])
        put(e, "shadow_step_count", p["shadow_steps"])
        put(e, "use_bokeh_jittered", p["dof_jitter"])
    r.resolution_percentage = int(p["scale"])
    p["skipped"] = skipped
    p["name"] = name
    return p


def set_output(scene, path, quality=95):
    """Point the scene output at `path`; format from the extension (.jpg or .png)."""
    s = scene.render.image_settings
    try:
        s.media_type = "IMAGE"
    except Exception:
        pass
    if path.lower().endswith((".jpg", ".jpeg")):
        s.file_format, s.quality, s.color_mode = "JPEG", int(quality), "RGB"
    else:
        s.file_format, s.color_mode = "PNG", "RGB"
    scene.render.use_file_extension = False
    scene.render.filepath = path


def render_still(scene, path, frame=None, preset="preview", quality=90, **overrides):
    """Render one frame to `path` in the foreground. Keep it short: preview-size Eevee only.

    Returns dict(path, seconds, frame).
    """
    if preset:
        apply_preset(scene, preset, **overrides)
    if frame is not None:
        scene.frame_set(int(frame))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    set_output(scene, path, quality)
    t = time.time()
    bpy.ops.render.render(write_still=True)
    return {"path": path, "seconds": round(time.time() - t, 2), "frame": scene.frame_current}


def contact_sheet(paths, out_path, cols=3):
    """Tile same-size images into one JPEG, left to right, top to bottom."""
    import numpy as np

    tiles = []
    for p in paths:
        img = bpy.data.images.load(p, check_existing=False)
        w, h = img.size
        a = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(a)
        tiles.append(a.reshape(h, w, 4))
        bpy.data.images.remove(img)
    h, w = tiles[0].shape[:2]
    rows = int(math.ceil(len(tiles) / float(cols)))
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    sheet[..., 3] = 1.0
    for i, t in enumerate(tiles):
        y0 = (rows - 1 - i // cols) * h  # image rows run bottom-up
        x0 = (i % cols) * w
        sheet[y0:y0 + h, x0:x0 + w] = t
    out = bpy.data.images.new("rb_contact_sheet", cols * w, rows * h, alpha=False)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = out_path
    out.file_format = "JPEG"
    out.save()
    bpy.data.images.remove(out)
    return out_path


def render_strip(scene, frames, out_path, preset="preview", cols=3, **overrides):
    """Render several frames small and tile them into one image: one look for a whole action.

    Returns dict(path, seconds_per_frame). Keep frames * seconds under a minute.
    """
    tmp = os.path.join(os.path.dirname(out_path), "_strip")
    paths, secs = [], []
    for f in frames:
        r = render_still(scene, os.path.join(tmp, "f%04d.jpg" % f), frame=f, preset=preset, **overrides)
        paths.append(r["path"])
        secs.append(r["seconds"])
    contact_sheet(paths, out_path, cols=cols)
    return {"path": out_path, "seconds_per_frame": secs}
