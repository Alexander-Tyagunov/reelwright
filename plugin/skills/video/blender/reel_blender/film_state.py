"""The registry of a film for one Blender session: its look, its builders, its plan, and the shot that is live.

`film.register(...)` fills it; every other film module reads it through `film_data()`. A film owns every value of its
look; nothing here is the library's.
"""
import json
import os

from . import plan as PL

STATE = {}
_FILM = {}


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
    plan: the plan as a dict, or the path of its json (read as UTF-8). look: a Look. builders: {shot id: fn(sh)} that
    build the set pieces in view, bake the animation and register the track points in sh.points. shot_params:
    {shot id: dict} that go on top of look.params. extra_shots: {shot id: spec} for shots that are not in the plan (an
    intro): same shape as a plan entry. Raises ValueError for a shot id that is not letters, digits, '-' and '_'.
    Returns the shot ids it can build."""
    if isinstance(plan, str):
        with open(plan, encoding="utf-8") as fh:
            plan = json.load(fh)
    shots = PL.plan_shots(plan)
    for shot_id in extra_shots or {}:
        PL.check_shot_id(shot_id)
    shots.update(extra_shots or {})
    _FILM.clear()
    _FILM.update(name=name, project=project, plan=plan, look=look, builders=dict(builders), shots=shots,
                 formats=PL.plan_formats(plan), fps=PL.plan_fps(plan), shot_params=dict(shot_params or {}))
    STATE.clear()
    return sorted(shots)


def film_data():
    """The registered film (a dict); raises RuntimeError when no film is registered."""
    if not _FILM:
        raise RuntimeError("no film registered: call film.register(...) first")
    return _FILM


def format_key(fmt):
    """The format key to use: the main format of the plan when fmt is None. Raises KeyError for an unknown format."""
    formats = film_data()["formats"]
    key = fmt or next(iter(formats))
    if key not in formats:
        raise KeyError("format %r is not in the plan (it has %s)" % (key, sorted(formats)))
    return key


def suffix(fmt):
    """'' for the main format, '@9x16' for a second one: the folder and file suffix."""
    key = format_key(fmt)
    return "" if key == next(iter(film_data()["formats"])) else "@" + key.replace(":", "x")


def check_open_file(filepath, is_dirty, force=False):
    """Refuse to empty a scene that holds unsaved work that is not this film's.

    filepath and is_dirty are `bpy.data.filepath` and `bpy.data.is_dirty`. A file with no unsaved changes may be
    emptied (it is still on disk); so may a file that is one of this film's own shot files (`<project>/blends/<name>-*`,
    the files `submit` writes). Anything else raises RuntimeError that says what to do. `force=True` skips the check."""
    if force or not is_dirty:
        return
    f = film_data()
    own = os.path.normcase(os.path.abspath(os.path.join(f["project"], "blends")))
    here = os.path.normcase(os.path.abspath(os.path.dirname(filepath))) if filepath else None
    if here == own and os.path.basename(filepath).startswith(f["name"] + "-"):
        return
    raise RuntimeError(
        "the open Blender file (%s) has unsaved changes and is not one of this film's shot files, and build_shot "
        "empties the open scene in memory. Save it, or ask the owner to, then call build_shot again; or call "
        "build_shot(..., force=True) when the owner has said the open scene may be thrown away."
        % (filepath or "never saved"))
