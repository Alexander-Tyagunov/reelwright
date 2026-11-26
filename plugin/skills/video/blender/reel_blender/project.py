"""Scene and project setup. Units: metres; time in frames at the scene fps."""
import bpy


def clean_scene(scene=None):
    """Remove every object, collection and unused datablock, so a build starts from nothing."""
    scene = scene or bpy.context.scene
    if hasattr(scene, "compositing_node_group"):
        try:
            scene.compositing_node_group = None
        except Exception:
            pass
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for _ in range(3):
        try:
            bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
        except TypeError:
            bpy.data.orphans_purge()
    return scene


def setup_scene(scene=None, fps=30, width=1920, height=1080, frame_start=1, frame_end=250,
                view_transform="AgX", look=None, exposure=0.0, gamma=1.0, dither=1.0):
    """Set fps, resolution (pixels), frame range, metric units and colour management.

    look: name of a view-transform look, with or without the 'AgX - ' prefix; ignored if unknown.
    exposure in stops. dither: 8-bit output dither strength (raise to 2 for dark gradients that band).
    Returns what was applied.
    """
    scene = scene or bpy.context.scene
    r = scene.render
    r.fps, r.fps_base = int(fps), 1.0
    r.resolution_x, r.resolution_y, r.resolution_percentage = int(width), int(height), 100
    r.pixel_aspect_x = r.pixel_aspect_y = 1.0
    r.use_motion_blur = False
    r.dither_intensity = dither
    r.film_transparent = False
    scene.frame_start, scene.frame_end = int(frame_start), int(frame_end)
    scene.frame_set(int(frame_start))
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    vs = scene.view_settings
    applied = {"fps": fps, "size": [width, height], "frames": [frame_start, frame_end]}
    try:
        vs.view_transform = view_transform
    except Exception:
        pass
    applied["view_transform"] = vs.view_transform
    if look:
        for cand in (look, "AgX - " + look, look.replace("AgX - ", "")):
            try:
                vs.look = cand
                break
            except Exception:
                continue
    applied["look"] = vs.look
    vs.exposure, vs.gamma = exposure, gamma
    return applied


def collection(name, parent=None, scene=None):
    """Get or create a collection linked under `parent` (default: the scene collection)."""
    scene = scene or bpy.context.scene
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        (parent or scene.collection).children.link(col)
    return col


def save(path):
    """Save the .blend to an absolute path (background renders read the saved file)."""
    bpy.ops.wm.save_as_mainfile(filepath=path)
    return bpy.data.filepath
