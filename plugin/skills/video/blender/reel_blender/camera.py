"""Camera helpers: a camera aimed at a target empty, eased keyed moves, depth of field.
Units: metres, millimetres for lens and sensor, frames."""
import bpy

from . import anim


def make_empty(name, location=(0.0, 0.0, 0.0), collection=None, parent=None, size=0.15):
    """Empty used as camera target, focus point or label anchor (parent it to what it follows)."""
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = size
    ob.location = location
    (collection or bpy.context.scene.collection).objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def make_camera(name="Camera", lens=50.0, sensor_width=36.0, clip=(0.1, 1000.0), collection=None,
                scene=None, make_active=True):
    """Perspective camera; lens and sensor width in mm, clip range in metres."""
    data = bpy.data.cameras.new(name)
    data.lens, data.sensor_width = lens, sensor_width
    data.clip_start, data.clip_end = clip
    ob = bpy.data.objects.new(name, data)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if make_active:
        (scene or bpy.context.scene).camera = ob
    return ob


def aim_at(cam, target):
    """Keep the camera pointed at `target` (Track To, -Z forward, Y up)."""
    c = cam.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis, c.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    return c


def key_move(obj, keys, interpolation="BEZIER", easing="AUTO"):
    """Key locations [(frame, (x, y, z))]. Default: one smooth eased path through all keys."""
    return anim.key(obj, "location", keys, interpolation=interpolation, easing=easing)


def key_lens(cam, keys):
    """Key the focal length [(frame, mm)] for zooms."""
    return anim.key(cam.data, "lens", keys)


def set_dof(cam, focus_object=None, distance=None, fstop=2.8):
    """Depth of field: focus on an object (key its location to pull focus) or at a distance in metres."""
    dof = cam.data.dof
    dof.use_dof = True
    if focus_object is not None:
        dof.focus_object = focus_object
    if distance is not None:
        dof.focus_distance = distance
    dof.aperture_fstop = fstop
    return dof


def lens_character(cam, blades=7, rotation=0.3, ratio=1.0):
    """Give the out-of-focus highlights the shape of a real iris: blade count, rotation (radians), and
    ratio (1 = round lens, 2 = anamorphic ovals)."""
    dof = cam.data.dof
    dof.aperture_blades, dof.aperture_rotation, dof.aperture_ratio = int(blades), rotation, ratio
    return dof


def slider(obj, frames, start, end, progress, jitter=None):
    """Stop-motion camera (or target) on a slider: at frames[i] it stands at start + (end - start) * progress[i]
    plus jitter[i][:3] (metres), and stays there until the next frame (constant keys, no glide).
    progress: e.g. craft.hand_slide(); jitter: e.g. craft.pose_jitter(). Returns the positions."""
    pos = []
    for i in range(len(frames)):
        j = jitter[i] if jitter else (0.0, 0.0, 0.0)
        pos.append(tuple(start[k] + (end[k] - start[k]) * progress[i] + j[k] for k in range(3)))
    anim.bake_vec(obj, "location", frames, pos, "CONSTANT")
    return pos
