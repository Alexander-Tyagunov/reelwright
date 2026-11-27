"""Camera and focus of a shot: the plan's camera for the shot's format, a hand push, and the focus that follows the
subject points (needs Blender)."""
from mathutils import Vector

from . import anim as A, camera as C, craft as K, tracks as T
from . import plan as PL
from .film_state import film_data


def build_camera(sh):
    """Camera of the plan for the shot's format: locked off, or pushed by hand over the poses in `moves`; lens and
    f-stop from the plan (parameters lens, fstop, cam_pos, cam_aim override), clip 2 cm to 30 m. Focus: per pose the
    harmonic mean of the nearest and farthest depth among the in-focus points that are visible, smoothed over three
    poses. A focus pull (plan or parameter `focus_pull`) ends on its point. Sets sh.cam and sh.dfoc (m per pose).
    Only the first entry of `moves` is used."""
    c, p, n = PL.shot_camera(sh.spec, sh.fmt), sh.p, sh.poses
    prefix = film_data()["look"].prefix
    pos1, aim1 = tuple(p.get("cam_pos", c["pos"])), tuple(p.get("cam_aim", c["aim"]))
    pos0, aim0 = tuple(c.get("pos_start", pos1)), tuple(c.get("aim_start", aim1))
    cam = C.make_camera("%s_Camera" % prefix, p.get("lens", c.get("lens_mm", 40.0)), clip=(0.02, 30.0),
                        collection=sh.trk, scene=sh.scene)
    tgt = C.make_empty("%s_CamTarget" % prefix, aim0, sh.trk, size=0.01)
    foc = C.make_empty("%s_Focus" % prefix, (0.0, 0.0, 0.02), sh.trk, size=0.01)
    C.aim_at(cam, tgt)
    moves = c.get("moves") or []
    prog = K.hand_slide(5, n, moves[0][0] - 1, moves[0][1] - 1, 0.3) if moves else [1.0] * n
    moving = [0.0 < prog[i] < 1.0 or (i > 0 and prog[i] != prog[i - 1]) for i in range(n)]
    C.slider(cam, sh.FR, pos0, pos1, prog, K.pose_jitter(6, n, 0.00012, 0.0, moving))
    C.slider(tgt, sh.FR, aim0, aim1, prog, K.pose_jitter(7, n, 0.0004, 0.0, moving))
    dfoc = _focused_distances(sh, cam)
    fpos = []
    for i, q in enumerate(sh.FR):
        sh.scene.frame_set(q)
        mw = cam.matrix_world
        w = mw.translation + (mw.to_quaternion() @ Vector((0.0, 0.0, -1.0))) * dfoc[i]
        fpos.append((w[0], w[1], w[2]))
    A.bake_vec(foc, "location", sh.FR, fpos, "CONSTANT")
    C.set_dof(cam, foc, fstop=p.get("fstop", c.get("fstop", 16.0)))
    C.lens_character(cam, blades=7, rotation=0.4)
    sh.cam, sh.dfoc = cam, dfoc
    return cam


def _focused_distances(sh, cam):
    """Focus distance (m) per pose: the in-focus points, then a hand focus pull that ends on its own point."""
    p, n = sh.p, sh.poses
    pull = PL.shot_focus_pull(sh.spec) if "focus_pull" not in p else p["focus_pull"]
    pull = pull if (pull and pull[2] in sh.points) else None
    names = [k for k in p.get("in_focus", PL.shot_in_focus(sh.spec)) if k in sh.points and not (pull and k == pull[2])]
    dfoc = _focus_distances(sh, cam, {k: sh.points[k] for k in names})
    if pull:
        far = T.sample_points(sh.scene, cam, {pull[2]: sh.points[pull[2]]}, sh.FR)[pull[2]]["depth"]
        turn = K.hand_slide(8, n, pull[0] - 1, pull[1] - 1, 0.3)
        dfoc = [1.0 / ((1.0 - u) / a + u / b) for a, b, u in zip(dfoc, far, turn)]
    return dfoc


def _focus_distances(sh, cam, subjects):
    """Focus distance (m) per pose for the subject points: harmonic mean of nearest and farthest visible depth."""
    dep = T.sample_points(sh.scene, cam, subjects, sh.FR)
    out = []
    for i in range(sh.poses):
        ds = ([dep[k]["depth"][i] for k in subjects if dep[k]["visible"][i]]
              or [dep[k]["depth"][i] for k in subjects if dep[k]["depth"][i] > 0.05] or [0.5])
        lo, hi = min(ds), max(ds)
        out.append(2.0 * lo * hi / (lo + hi))
    return [sum(out[max(0, i - 1):i + 2]) / len(out[max(0, i - 1):i + 2]) for i in range(len(out))]
