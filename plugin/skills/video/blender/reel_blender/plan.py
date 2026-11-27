"""Reading the shot plan: the one module that knows the plan's field names (no bpy; the twin of plan/parse.ts).

The plan is the file `references/shot-plan.md` describes. The engine reads it with `plan/parse.ts`, the 3D side reads
it only through the functions below, so a renamed field costs one line. Pose p is scene frame p; the plan's
`fps_poses` is the rate of poses (12 for stop motion).

    plan_shots / plan_formats / plan_fps     the plan
    shot_poses / shot_tracks / shot_events   what a shot exports
    shot_in_focus / shot_focus_pull          what the focus follows
    shot_camera                              the camera of a shot for a format
    plate_folder                             where a shot's plate lives, the same rule as the engine
"""
import re

DEFAULT_FORMATS = {"16:9": [1920, 1080]}
SHOT_ID = re.compile(r"^[A-Za-z0-9_-]+$")


def check_shot_id(shot_id):
    """Return the id when it is made of letters, digits, '-' and '_' only; else raise ValueError that names it.
    A shot id becomes a folder and a file name, so it may not hold a path."""
    if not isinstance(shot_id, str) or not SHOT_ID.match(shot_id):
        raise ValueError("shot id %r must use only letters, digits, '-' and '_' (it names a plate folder and a file)"
                         % (shot_id,))
    return shot_id


def plan_shots(plan):
    """{shot id: shot entry} from plan['sequences'][*]['shots'][*]. The one place the nesting is known.
    Raises ValueError for an id that is not letters, digits, '-' and '_'."""
    return {check_shot_id(s["id"]): s for q in plan["sequences"] for s in q["shots"]}


def plan_formats(plan):
    """{ratio: (width, height)} from plan['formats'] (pixels), in the plan's order; the first is the main format."""
    return {k: tuple(v) for k, v in (plan.get("formats") or DEFAULT_FORMATS).items()}


def plan_fps(plan, default=12):
    """Poses per second from plan['fps_poses']."""
    return int(plan.get("fps_poses", default))


def shot_poses(spec):
    """Number of poses of a shot: spec['poses']."""
    return int(spec["poses"])


def shot_tracks(spec):
    """Names of the points exported to tracks.json: spec['tracks'] (may be empty)."""
    return list(spec.get("tracks", []))


def shot_events(spec):
    """[(name, pose)] from spec['events'] (each {'name', 'pose'}); written to tracks.json as frame = pose - 1."""
    return [(e["name"], int(e["pose"])) for e in spec.get("events", [])]


def shot_in_focus(spec):
    """Names of the points the focus follows: spec['in_focus']."""
    return list(spec.get("in_focus", []))


def shot_focus_pull(spec):
    """(first pose, last pose, point name) of a hand focus pull from spec['focus_pull'] = {'poses': [a, b], 'to': name},
    or None."""
    fp = spec.get("focus_pull")
    return (int(fp["poses"][0]), int(fp["poses"][1]), fp["to"]) if fp else None


def shot_camera(spec, fmt=None):
    """The camera dict of a shot for a format: spec['camera'] with the entries of spec['camera']['formats'][fmt] on top.

    Entries: lens_mm, fstop, pos, aim (metres), and for a pushed move pos_start, aim_start, moves = [[first pose, last
    pose]]."""
    cam = dict(spec["camera"])
    per_format = cam.pop("formats", None) or {}
    cam.update(per_format.get(fmt, {}))
    return cam


def plate_folder(shot_id, spec, suffix=""):
    """The plate folder of a shot, relative to the film folder: spec['plate'] when the shot names one, else
    'plates/<id>'; then `suffix` ('@9x16' for a second format) unless the folder already ends with it. The engine
    (plan/formats.ts) applies the same rule. Raises ValueError for a folder that is absolute or leaves the film
    folder."""
    base = (spec.get("plate") or "plates/" + check_shot_id(shot_id)).rstrip("/")
    if base.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", base) or ".." in re.split(r"[/\\]", base):
        raise ValueError("shot %s: plate %r must be a folder inside the film folder, such as plates/%s"
                         % (shot_id, base, shot_id))
    return base if base.endswith(suffix) else base + suffix
