"""Keyframes and per-frame bakes for Blender 4.4+/5.x layered actions (Action.fcurves is gone in 5.x).

Reproducible animation only: values come from the caller's math, never from playback or the clock.
"""
import bpy
from bpy_extras import anim_utils

_INTERP = {"CONSTANT": 0, "LINEAR": 1, "BEZIER": 2}


def channelbag(idb):
    """Ensure the datablock (object, mesh, light, ...) has an action, a slot and a channelbag; return it."""
    ad = idb.animation_data or idb.animation_data_create()
    act = ad.action
    if act is None:
        act = bpy.data.actions.new(idb.name + "Action")
        ad.action = act
    slot = ad.action_slot
    if slot is None:
        slot = act.slots.new(id_type=idb.id_type, name=idb.name)
        ad.action_slot = slot
    return anim_utils.action_ensure_channelbag_for_slot(act, slot)


def fcurve(idb, data_path, index=0):
    cb = channelbag(idb)
    return cb.fcurves.find(data_path, index=index) or cb.fcurves.new(data_path, index=index)


def bake(idb, data_path, frames, values, index=0, interpolation="LINEAR"):
    """Write one key per frame on one channel in bulk (fast: thousands of keys per call)."""
    fc = fcurve(idb, data_path, index)
    kp = fc.keyframe_points
    if len(kp):
        kp.clear()
    n = len(frames)
    kp.add(n)
    co = [0.0] * (2 * n)
    co[0::2] = [float(f) for f in frames]
    co[1::2] = [float(v) for v in values]
    kp.foreach_set("co", co)
    try:
        kp.foreach_set("interpolation", [_INTERP[interpolation]] * n)
    except Exception:
        for k in kp:
            k.interpolation = interpolation
    fc.update()
    return fc


def bake_vec(idb, data_path, frames, vectors, interpolation="LINEAR"):
    """Bake a vector property: vectors[i] is the tuple at frames[i]."""
    for idx in range(len(vectors[0])):
        bake(idb, data_path, frames, [v[idx] for v in vectors], idx, interpolation)


def key(idb, data_path, keys, index=0, interpolation="BEZIER", easing="AUTO", handles="AUTO_CLAMPED"):
    """Sparse keys [(frame, value)]; value a float (on `index`) or a tuple (all channels).

    BEZIER with AUTO_CLAMPED handles eases through every key without overshoot;
    use interpolation 'SINE' / 'CUBIC' / 'BACK' ... with easing 'EASE_IN_OUT' etc. for named eases,
    or 'CONSTANT' for switches.
    """
    vec = isinstance(keys[0][1], (tuple, list))
    out = []
    for idx in (range(len(keys[0][1])) if vec else (index,)):
        fc = fcurve(idb, data_path, idx)
        for f, v in keys:
            k = fc.keyframe_points.insert(float(f), float(v[idx] if vec else v), options={"FAST"})
            k.interpolation = interpolation
            k.easing = easing
            k.handle_left_type = k.handle_right_type = handles
        fc.update()
        out.append(fc)
    return out


def bake_vertices(mesh, frames, positions, interpolation="LINEAR"):
    """Animate mesh vertices: positions[i][v] = (x, y, z) of vertex v at frames[i] (object space, m).
    interpolation="CONSTANT" holds every pose (stop motion)."""
    for v in range(len(positions[0])):
        path = "vertices[%d].co" % v
        for idx in range(3):
            bake(mesh, path, frames, [p[v][idx] for p in positions], idx, interpolation)
