"""reel_blender: Blender-side helpers for Reelwright 3D plates.

A plate is a folder of rendered frames plus tracks.json (screen positions of
named points per frame) that the Reelwright engine composites labels over.

Modules
  motion      pure math: easing, arc-length paths, hop cycles, ribbon chains (no bpy)
  craft       pure math: seeded hand-made irregularity (cut edges, strokes, pose jitter, flicker, slider)
  plate       pack / check a plate folder (no bpy)
  project     clean scene, fps / resolution / colour management, collections, save
  mesh        build meshes from python data (revolve, loft, prism, box, merge)
  anim        keyframes and per-frame bakes on Blender 4.4+/5.x layered actions
  camera      camera, target, eased keyed moves, depth of field
  render      presets (preview, draft, final, cycles_still), stills, contact sheets
  background  detached background render with a progress file
  tracks      export tracks.json for the engine
  paper       paper / card material builder, plain materials
  photo       lens and sensor faults on a rendered frame (vignette, fringe, grain, flicker)
  renderqueue one-at-a-time render queue shared by several sessions (submit, status, cancel; no bpy needed)
  film        plan-driven film work with no look: register a look and builders, build_shot, strip, submit, export_tracks, status
  lettering   hand lettering and printed text as image textures (Pillow, numpy; run in the workspace; import it by name)
  stills      still pictures: render at a size, circle check sheet, banner crops, watermark cut (Pillow; import by name)
  checks      edge energy, brightness, shift and match of two frames (Pillow, numpy; import by name)

Nothing here holds a look or a project path; films keep those in their own scripts.
Units: metres, frames at the scene fps, radians.
"""
import importlib

__version__ = "0.3.0"

from . import motion, plate, craft, renderqueue  # noqa: F401  (usable without Blender)

try:
    import bpy  # noqa: F401
    _HAVE_BPY = True
except ImportError:  # outside Blender: only motion and plate
    _HAVE_BPY = False

if _HAVE_BPY:
    from . import project, mesh, anim, camera, render, background, tracks, paper, photo, film  # noqa: F401


def reload_all():
    """Reload every module after the files changed on disk (call from the live Blender)."""
    names = ["motion", "plate", "craft", "renderqueue"]
    if _HAVE_BPY:
        names += ["project", "mesh", "anim", "paper", "photo", "camera", "render", "background", "tracks", "film"]
    g = globals()
    for n in names:
        g[n] = importlib.reload(g[n])
    return names
