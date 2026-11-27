"""The set of the example film: constants, the desk, the doorway, the lamps and the light that switches on."""

import math
import os

import bpy
from mathutils import Matrix

from reel_blender import mesh as G, anim as A, camera as C, craft as K, motion as M
import look as L

pi, MM, CARD = math.pi, L.MM, L.CARD
TAG_PNG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "tag.png")
# where the doorway stands, and its heading
DOOR_AT, DOOR_HEADING = (-1.4703237, 0.0199988), 0.0530000
SHEET_AT = (-1.5103087, 0.0194325)                              # where the sheet lies
# track name, x in the doorway, size, thread drop (m)
LAMPS = [("lamp_a", -0.0115, 0.011, 0.003), ("lamp_b", 0.0122, 0.007, 0.0025)]
# first pose, last pose, arc (rad), lean back (rad), slat bow, then where the hand put it: shift in x, toward the lens
# (m), yaw
ROLL = [
    (1, 6, 0.35, pi / 2, 0.0, -0.003, 0.030, 0.30), (7, 8, 1.15, 0.95, 0.0, -0.004, 0.016, 0.30), (9, 10, 2.7, 0.32,
    0.0, -0.003, 0.005, 0.25),
    (11, 12, 4.5, 0.0, 0.1, 0.0, 0.0, 0.25), (13, 14, 5.85, 0.0, 0.5, 0.0, 0.0, 0.22)]
# the punched hole: from the left edge, from the bottom, radius, radius of its paper ring (m)
HOLE = (0.0078, 0.031, 0.0023, 0.0046)
# lamp on, lamp off, tag taken away, the light and focus of the next shot
S1_ON, S1_OFF, S1_GONE, S1_MATCH = 3, 21, 22, 23


def f30(pose):
    """Time of a pose in 30ths of a second."""
    return (pose - 1) * 2.5


# ---------------------------------------------------------------- the set
def desk(sh):
    """Two long boards, seam under the backdrop spine at y = 0.45."""
    for k, (a, b) in enumerate(((-0.7, 0.4492), (0.4508, 1.15))):
        G.new_object("PD_Desk%d" % k, G.box((3.6, b - a, 0.03), (0.0, (a + b) / 2, -0.018)), sh.env, sh.mats["wood"])


def cutting_mat(sh):
    """The cutting mat, 3 mm thick, its top at z = 0."""
    return G.card("PD_Mat", [(-1.62, -0.3), (-0.44, -0.3), (-0.44, 0.3), (-1.62, 0.3)], 0.003, sh.env, sh.mats["mat"],
            sh.mats["mat"], z0=-0.003)


def knife(sh, at, yaw):
    """A craft knife put down at (x, y), pointing along yaw."""
    kn = C.make_empty("PD_Knife", (at[0], at[1], 0.0041), sh.env, size=0.01)
    kn.rotation_euler = (0.3, pi / 2, yaw)
    L.part("PD_Knife_handle", G.revolve([(0.004, 0.0), (0.004, 0.105), (0.0031, 0.108), (0.0031, 0.118)], 16), sh.env,
            sh.mats["steel"], kn, smooth_angle=math.radians(35))
    L.part("PD_Knife_blade", G.transform(G.prism([(-0.0035, 0.118), (0.0035, 0.118), (0.0035, 0.146)], -0.0002,
            0.0002), Matrix.Rotation(pi / 2, 4, "X")), sh.env, sh.mats["steel"], kn)


def scraps(sh, items, seed=17, salt="A1"):
    """Offcuts on the mat: items = [(x, y, material key, size m)]. salt is part of the seed key, so the same salt gives
    the same offcuts."""
    r = K.rng(seed, "scraps", salt)
    for i, (x, y, key, s) in enumerate(items):
        tri = [(0.0, 0.0), (s * r.uniform(1.0, 2.4), s * r.uniform(-0.2, 0.2)), (s * r.uniform(0.2, 1.0),
                s * r.uniform(0.6, 1.2))]
        ang = r.uniform(0, 6.28)
        poly = K.hand_cut([(px * math.cos(ang) - py * math.sin(ang), px * math.sin(ang) + py * math.cos(ang)) for px,
                py in tri], seed + i, 0.0003, 0.004, 0.01)
        ob = G.new_object("PD_Scrap%d" % i, G.prism(poly, 0.0, 0.00012), sh.env, sh.mats[key])
        ob.location, ob.rotation_euler = (x, y, 0.0002), (r.uniform(-0.05, 0.05), r.uniform(-0.05, 0.05), 0.0)


def hang(sh, name, root, at, size, drop, track):
    """A lantern on a thread from a hanger at root-space `at`; its LED starts at 0 W; the track point stays fixed on the
    root."""
    hanger = C.make_empty(name + "_hanger", at, sh.env, parent=root, size=0.005)
    L.part(name + "_thread", G.box((0.00028, 0.00028, drop), (0.0, 0.0, -drop / 2)), sh.env, sh.mats["thread"], hanger)
    s = size
    body = L.part(name + "_body", G.revolve([(0.30 * s, -s), (0.5 * s, -0.75 * s), (0.5 * s, -0.2 * s), (0.28 * s,
            0.0)], 10, True, False), sh.env, sh.mats["p_lantern"], hanger)
    body.location = (0.0, 0.0, -drop)
    ld = bpy.data.lights.new(name + "_led", "POINT")
    ld.energy, ld.shadow_soft_size, ld.color = 0.0, s * 0.25, L.PAL["led"]
    lo = bpy.data.objects.new(name + "_led", ld)
    sh.env.objects.link(lo)
    lo.parent, lo.location = hanger, (0.0, 0.0, -drop - 0.5 * s)
    sh.points[track] = C.make_empty("TRK_" + track, (at[0], at[1], at[2] - drop - 0.5 * s), sh.trk, parent=root,
            size=0.004)
    sh.lamps[track] = {"hanger": hanger, "light": ld, "size": size, "power": max(0.0012,
            0.0012 * (size / 0.008) ** 2.27)}


def doorway(sh, cheat):
    """A kraft frame 55 mm wide and 75 mm tall cut in one piece, taped at the feet with a strut behind, and two lamps
    hung in the top corners of the opening. cheat: radians the frame is turned toward the lens."""
    r, seed = K.rng(311, "door"), 311
    root = C.make_empty("PD_Doorway", (DOOR_AT[0], DOOR_AT[1], 0.0), sh.env, size=0.01)
    root.rotation_euler = (0.0, 0.0, DOOR_HEADING + pi / 2 - cheat)
    j = lambda: r.uniform(-0.0005, 0.0005)
    poly = [(-0.0275 + j(), 0.0), (-0.0195 + j(), 0.0), (-0.0195 + j(), 0.066 + j()), (0.0195 + j(), 0.066 + j()),
            (0.0195 + j(), 0.0),
            (0.0275 + j(), 0.0), (0.0275 + j(), 0.075 + j()), (-0.0275 + j(), 0.075 + j())]
    card = G.card("PD_DoorCard", K.hand_cut(poly, seed, 0.0005, 0.005, 0.02), CARD, sh.env, sh.mats["kraft"],
            sh.mats["core"])
    card.parent, card.rotation_euler = root, (pi / 2 - 0.035, 0.0, 0.0)
    z = CARD + 0.00004
    pencil = G.merge([K.stroke_strip([(-0.027, 0.0664), (0.0268, 0.0657)], 0.00026, seed + 1, 0.00006, 0.001, z),
                      K.stroke_strip([(0.0004, 0.0668), (-0.0003, 0.0742)], 0.00026, seed + 2, 0.00006, 0.001, z),
                      K.stroke_strip([(-0.0242, 0.021), (-0.0232, 0.031)], 0.0007, seed + 3, 0.0001, 0.0008, z, 0.4)])
    G.new_object("PD_DoorPencil", pencil, sh.env, sh.mats["graphite"]).parent = card
    for k, sx in enumerate((-1.0, 1.0)):
        L.tape("PD_DoorFootTape%d" % k, sh.env, sh.mats, 0.02, 0.012, seed + 10 + k, 0.15 * sx, (0.0235 * sx, 0.005),
                CARD + 0.00002, card)
        L.tape("PD_DoorMatTape%d" % k, sh.env, sh.mats, 0.026, 0.012, seed + 12 + k, r.uniform(-0.3, 0.3),
                (0.0245 * sx, -0.009), 0.00015, root)
    strut = G.card("PD_DoorStrut", K.hand_cut([(0.0, 0.0), (0.024, 0.0), (0.0, 0.05)], seed + 20, 0.0004, 0.01, 0.03),
            CARD, sh.env, sh.mats["kraft"], sh.mats["core"])
    strut.parent, strut.location, strut.rotation_euler = root, (0.0235, 0.0008, 0.0), (pi / 2, 0.0, pi / 4)
    for i, (track, lx, size, drop) in enumerate(LAMPS):
        G.new_object("PD_DoorThread%d" % i, K.stroke_strip([(lx, 0.0655), (lx + 0.001, 0.0705)], 0.0003, seed + 30 + i,
                0.0001, 0.002, CARD + 0.0003), sh.env, sh.mats["thread"]).parent = card
        L.tape("PD_DoorThreadTape%d" % i, sh.env, sh.mats, 0.011, 0.007, seed + 35 + i, r.uniform(-0.3, 0.3),
                (lx + 0.001, 0.0712), CARD + 0.00034, card)
        hang(sh, "PD_" + track, root, (lx, -CARD / 2, 0.066), size, drop, track)


def swing(sh, times, kicks=(), rest=0.02):
    """Hanging lamps never hang still: an idle swing plus a decaying swing after each kick [(f, radians)]; times = f per
    pose."""
    for i, lamp in enumerate(sh.lamps.values()):
        rot = []
        for f in times:
            amp = rest + sum(a * math.exp(-(f - kf) / 24.0) for kf, a in kicks if f >= kf)
            w = 0.21 - 0.02 * i
            rot.append((0.5 * amp * math.sin(w * 0.83 * f + 0.9 + i), amp * math.sin(w * f + 1.7 * i), 0.0))
        A.bake_vec(lamp["hanger"], "rotation_euler", sh.FR, rot, "CONSTANT")


def light_lamp(sh, track, pose, quick=False):
    """Switch a lamp on at `pose`: 0, 1.7x, 0.8x, 1.0x of its watts over five poses, then its LED flicker (quick:
    faster, larger)."""
    lamp, lf = sh.lamps[track], f30(pose)
    fl = K.flicker(60 + int(lamp["size"] * 10000) + pose, sh.poses, 0.13 if quick else 0.06,
            slow=0.2 if quick else 0.5, wave=4.0 if quick else 9.0)
    lev = [(lf - 1, 0.0), (lf + 2, 1.7), (lf + 6, 0.8), (lf + 12, 1.0)]
    A.bake(lamp["light"], "energy", sh.FR, [lamp["power"] * M.interp_keys(lev, f30(q)) * fl[k] for k,
            q in enumerate(sh.FR)], 0, "CONSTANT")


def set_up(sh):
    """Desk, mat, doorway, knife and offcuts: the set every shot of the film stands on."""
    desk(sh)
    cutting_mat(sh)
    doorway(sh, math.radians(sh.p["door_cheat"]))
    knife(sh, (-1.555, -0.052), 0.12)
    scraps(sh, [(-1.498, -0.022, "p_lantern", 0.007), (-1.532, -0.040, "p_lantern", 0.005), (-1.462, -0.048, "kraft",
            0.008),
                (-1.415, -0.078, "p_tube", 0.006), (-1.335, -0.062, "kraft", 0.006), (-1.30, 0.10, "ivory", 0.008)])


def bake_blue(sh, shares=None):
    """Bake the clip lamp's energy with its flicker; shares = {pose: share of its light} for poses that depart from
    it."""
    fl = K.flicker(101, sh.poses, 0.025)
    A.bake(sh.lights["lamp"], "energy", sh.FR, [sh.p["lamp"] * (shares or {}).get(q, fl[q - 1]) for q in sh.FR], 0,
            "CONSTANT")
