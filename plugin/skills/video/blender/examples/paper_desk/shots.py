"""Shot builders of the example film: one desk, one doorway of kraft card, a flat sheet, a hand-lettered tag.

Each builder receives a film.Shot (scene, collections, materials, parameters, points) and builds only what its camera
sees, bakes the animation with constant keys from the pose number and fixed seeds, and registers the track points.
The three shots share one set (`set_up`) and differ in what happens on it:

    S1  intro, 24 poses: a work lamp flickers on over a lettered tag on its stand, holds, goes off, the tag is taken away
    S2  the flat sheet rolls itself up into a lantern shape in five replacement shapes (14 poses)
    S3  the two lamps in the doorway are lit one after the other and swing (30 poses)

Pose p is scene frame p; the choreography counts time in 30ths of a second: f = (p - 1) * 2.5.
"""
import math
import os

import bpy
from mathutils import Matrix

from reel_blender import mesh as G, anim as A, camera as C, craft as K, motion as M, paper as PP
import look as L

pi, MM, CARD = math.pi, L.MM, L.CARD
TAG_PNG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "tag.png")
DOOR_AT, DOOR_HEADING = (-1.4703237, 0.0199988), 0.0530000     # where the doorway stands, and the way the road runs there
SHEET_AT = (-1.5103087, 0.0194325)                              # where the sheet lies
LAMPS = [("lamp_a", -0.0115, 0.011, 0.003), ("lamp_b", 0.0122, 0.007, 0.0025)]   # track name, x in the doorway, size, thread drop (m)
ROLL = [  # first pose, last pose, arc (rad), lean back (rad), slat bow, then where the hand put it: shift in x, toward the lens (m), yaw
    (1, 6, 0.35, pi / 2, 0.0, -0.003, 0.030, 0.30), (7, 8, 1.15, 0.95, 0.0, -0.004, 0.016, 0.30), (9, 10, 2.7, 0.32, 0.0, -0.003, 0.005, 0.25),
    (11, 12, 4.5, 0.0, 0.1, 0.0, 0.0, 0.25), (13, 14, 5.85, 0.0, 0.5, 0.0, 0.0, 0.22)]
HOLE = (0.0078, 0.031, 0.0023, 0.0046)                           # the punched hole: from the left edge, from the bottom, radius, radius of its paper ring (m)
S1_ON, S1_OFF, S1_GONE, S1_MATCH = 3, 21, 22, 23                 # lamp on, lamp off, tag taken away, the light and focus of the next shot


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
    return G.card("PD_Mat", [(-1.62, -0.3), (-0.44, -0.3), (-0.44, 0.3), (-1.62, 0.3)], 0.003, sh.env, sh.mats["mat"], sh.mats["mat"], z0=-0.003)


def knife(sh, at, yaw):
    """A craft knife put down at (x, y), pointing along yaw."""
    kn = C.make_empty("PD_Knife", (at[0], at[1], 0.0041), sh.env, size=0.01)
    kn.rotation_euler = (0.3, pi / 2, yaw)
    L.part("PD_Knife_handle", G.revolve([(0.004, 0.0), (0.004, 0.105), (0.0031, 0.108), (0.0031, 0.118)], 16), sh.env, sh.mats["steel"], kn, smooth_angle=math.radians(35))
    L.part("PD_Knife_blade", G.transform(G.prism([(-0.0035, 0.118), (0.0035, 0.118), (0.0035, 0.146)], -0.0002, 0.0002), Matrix.Rotation(pi / 2, 4, "X")), sh.env, sh.mats["steel"], kn)


def scraps(sh, items, seed=17, salt="A1"):
    """Offcuts on the mat: items = [(x, y, material key, size m)]. salt is part of the seed key, so the same salt gives the same offcuts."""
    r = K.rng(seed, "scraps", salt)
    for i, (x, y, key, s) in enumerate(items):
        tri = [(0.0, 0.0), (s * r.uniform(1.0, 2.4), s * r.uniform(-0.2, 0.2)), (s * r.uniform(0.2, 1.0), s * r.uniform(0.6, 1.2))]
        ang = r.uniform(0, 6.28)
        poly = K.hand_cut([(px * math.cos(ang) - py * math.sin(ang), px * math.sin(ang) + py * math.cos(ang)) for px, py in tri], seed + i, 0.0003, 0.004, 0.01)
        ob = G.new_object("PD_Scrap%d" % i, G.prism(poly, 0.0, 0.00012), sh.env, sh.mats[key])
        ob.location, ob.rotation_euler = (x, y, 0.0002), (r.uniform(-0.05, 0.05), r.uniform(-0.05, 0.05), 0.0)


def hang(sh, name, root, at, size, drop, track):
    """A lantern on a thread from a hanger at root-space `at`; its LED starts at 0 W; the track point stays fixed on the root."""
    hanger = C.make_empty(name + "_hanger", at, sh.env, parent=root, size=0.005)
    L.part(name + "_thread", G.box((0.00028, 0.00028, drop), (0.0, 0.0, -drop / 2)), sh.env, sh.mats["thread"], hanger)
    s = size
    body = L.part(name + "_body", G.revolve([(0.30 * s, -s), (0.5 * s, -0.75 * s), (0.5 * s, -0.2 * s), (0.28 * s, 0.0)], 10, True, False), sh.env, sh.mats["p_lantern"], hanger)
    body.location = (0.0, 0.0, -drop)
    ld = bpy.data.lights.new(name + "_led", "POINT")
    ld.energy, ld.shadow_soft_size, ld.color = 0.0, s * 0.25, L.PAL["led"]
    lo = bpy.data.objects.new(name + "_led", ld)
    sh.env.objects.link(lo)
    lo.parent, lo.location = hanger, (0.0, 0.0, -drop - 0.5 * s)
    sh.points[track] = C.make_empty("TRK_" + track, (at[0], at[1], at[2] - drop - 0.5 * s), sh.trk, parent=root, size=0.004)
    sh.lamps[track] = {"hanger": hanger, "light": ld, "size": size, "power": max(0.0012, 0.0012 * (size / 0.008) ** 2.27)}


def doorway(sh, cheat):
    """A kraft frame 55 mm wide and 75 mm tall cut in one piece, taped at the feet with a strut behind, and two lamps
    hung in the top corners of the opening. cheat: radians the frame is turned toward the lens."""
    r, seed = K.rng(311, "door"), 311
    root = C.make_empty("PD_Doorway", (DOOR_AT[0], DOOR_AT[1], 0.0), sh.env, size=0.01)
    root.rotation_euler = (0.0, 0.0, DOOR_HEADING + pi / 2 - cheat)
    j = lambda: r.uniform(-0.0005, 0.0005)
    poly = [(-0.0275 + j(), 0.0), (-0.0195 + j(), 0.0), (-0.0195 + j(), 0.066 + j()), (0.0195 + j(), 0.066 + j()), (0.0195 + j(), 0.0),
            (0.0275 + j(), 0.0), (0.0275 + j(), 0.075 + j()), (-0.0275 + j(), 0.075 + j())]
    card = G.card("PD_DoorCard", K.hand_cut(poly, seed, 0.0005, 0.005, 0.02), CARD, sh.env, sh.mats["kraft"], sh.mats["core"])
    card.parent, card.rotation_euler = root, (pi / 2 - 0.035, 0.0, 0.0)
    z = CARD + 0.00004
    pencil = G.merge([K.stroke_strip([(-0.027, 0.0664), (0.0268, 0.0657)], 0.00026, seed + 1, 0.00006, 0.001, z),
                      K.stroke_strip([(0.0004, 0.0668), (-0.0003, 0.0742)], 0.00026, seed + 2, 0.00006, 0.001, z),
                      K.stroke_strip([(-0.0242, 0.021), (-0.0232, 0.031)], 0.0007, seed + 3, 0.0001, 0.0008, z, 0.4)])
    G.new_object("PD_DoorPencil", pencil, sh.env, sh.mats["graphite"]).parent = card
    for k, sx in enumerate((-1.0, 1.0)):
        L.tape("PD_DoorFootTape%d" % k, sh.env, sh.mats, 0.02, 0.012, seed + 10 + k, 0.15 * sx, (0.0235 * sx, 0.005), CARD + 0.00002, card)
        L.tape("PD_DoorMatTape%d" % k, sh.env, sh.mats, 0.026, 0.012, seed + 12 + k, r.uniform(-0.3, 0.3), (0.0245 * sx, -0.009), 0.00015, root)
    strut = G.card("PD_DoorStrut", K.hand_cut([(0.0, 0.0), (0.024, 0.0), (0.0, 0.05)], seed + 20, 0.0004, 0.01, 0.03), CARD, sh.env, sh.mats["kraft"], sh.mats["core"])
    strut.parent, strut.location, strut.rotation_euler = root, (0.0235, 0.0008, 0.0), (pi / 2, 0.0, pi / 4)
    for i, (track, lx, size, drop) in enumerate(LAMPS):
        G.new_object("PD_DoorThread%d" % i, K.stroke_strip([(lx, 0.0655), (lx + 0.001, 0.0705)], 0.0003, seed + 30 + i, 0.0001, 0.002, CARD + 0.0003), sh.env, sh.mats["thread"]).parent = card
        L.tape("PD_DoorThreadTape%d" % i, sh.env, sh.mats, 0.011, 0.007, seed + 35 + i, r.uniform(-0.3, 0.3), (lx + 0.001, 0.0712), CARD + 0.00034, card)
        hang(sh, "PD_" + track, root, (lx, -CARD / 2, 0.066), size, drop, track)


def swing(sh, times, kicks=(), rest=0.02):
    """Hanging lamps never hang still: an idle swing plus a decaying swing after each kick [(f, radians)]; times = f per pose."""
    for i, lamp in enumerate(sh.lamps.values()):
        rot = []
        for f in times:
            amp = rest + sum(a * math.exp(-(f - kf) / 24.0) for kf, a in kicks if f >= kf)
            w = 0.21 - 0.02 * i
            rot.append((0.5 * amp * math.sin(w * 0.83 * f + 0.9 + i), amp * math.sin(w * f + 1.7 * i), 0.0))
        A.bake_vec(lamp["hanger"], "rotation_euler", sh.FR, rot, "CONSTANT")


def light_lamp(sh, track, pose, quick=False):
    """Switch a lamp on at `pose`: 0, 1.7x, 0.8x, 1.0x of its watts over five poses, then its LED flicker (quick: faster, larger)."""
    lamp, lf = sh.lamps[track], f30(pose)
    fl = K.flicker(60 + int(lamp["size"] * 10000) + pose, sh.poses, 0.13 if quick else 0.06, slow=0.2 if quick else 0.5, wave=4.0 if quick else 9.0)
    lev = [(lf - 1, 0.0), (lf + 2, 1.7), (lf + 6, 0.8), (lf + 12, 1.0)]
    A.bake(lamp["light"], "energy", sh.FR, [lamp["power"] * M.interp_keys(lev, f30(q)) * fl[k] for k, q in enumerate(sh.FR)], 0, "CONSTANT")


def set_up(sh):
    """Desk, mat, doorway, knife and offcuts: the set every shot of the film stands on."""
    desk(sh)
    cutting_mat(sh)
    doorway(sh, math.radians(sh.p["door_cheat"]))
    knife(sh, (-1.555, -0.052), 0.12)
    scraps(sh, [(-1.498, -0.022, "p_lantern", 0.007), (-1.532, -0.040, "p_lantern", 0.005), (-1.462, -0.048, "kraft", 0.008),
                (-1.415, -0.078, "p_tube", 0.006), (-1.335, -0.062, "kraft", 0.006), (-1.30, 0.10, "ivory", 0.008)])


def bake_blue(sh, shares=None):
    """Bake the clip lamp's energy with its flicker; shares = {pose: share of its light} for poses that depart from it."""
    fl = K.flicker(101, sh.poses, 0.025)
    A.bake(sh.lights["lamp"], "energy", sh.FR, [sh.p["lamp"] * (shares or {}).get(q, fl[q - 1]) for q in sh.FR], 0, "CONSTANT")


# ---------------------------------------------------------------- the flat sheet that rolls itself up (S2)
def sheet_part(theta, tilt, bulge, seed=3):
    """A slit sheet (12 slats between two kraft bands) bent into an arc of `theta` radians (2 pi = closed) about the place where
    the lantern will stand, leaning back by `tilt` (pi / 2 = lying flat), slats bowed by `bulge` (0..1). Returns (slats, bands)."""
    r = K.rng(seed, "sheet")
    r0, length = 10.9 * MM, 2 * pi * 10.9 * MM
    rad_c = length / theta

    def pt(u, z, out=0.0):
        a = u * theta
        x, yy = (rad_c + out) * math.sin(a), -rad_c + (rad_c + out) * math.cos(a)
        return (x, r0 + yy * math.cos(tilt) + z * math.sin(tilt), -yy * math.sin(tilt) + z * math.cos(tilt) + 0.0002)

    slats = []
    for k in range(12):
        jit, bk, wdt = r.uniform(-0.06, 0.06), 4.6 * MM * r.uniform(0.85, 1.12), 3.3 * MM * r.uniform(0.85, 1.1)
        u0, du, verts = (k + 0.5) / 12.0 - 0.5 + jit / (2 * pi), wdt / (2 * length), []
        for j in range(9):
            v = j / 8.0
            out = bulge * bk * math.sin(pi * v) ** 0.8
            verts += [pt(u0 - du, (6 + 28 * v) * MM, out), pt(u0 + du, (6 + 28 * v) * MM, out)]
        slats.append((verts, [(2 * j, 2 * j + 1, 2 * j + 3, 2 * j + 2) for j in range(8)]))
    bands = []
    for z0, z1 in ((1 * MM, 6.4 * MM), (33.6 * MM, 39 * MM)):
        verts = []
        for i in range(25):
            verts += [pt(i / 24.0 - 0.5, z0, 0.0002), pt(i / 24.0 - 0.5, z1, 0.0002)]
        bands.append((verts, [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(24)]))
    return G.merge(slats), G.merge(bands)


def sheet(sh, k, theta, tilt, bulge, dx, near, psi):
    """Replacement shape number k of the sheet, placed where the hand put it. Returns its root."""
    r = K.rng(81, "roll", k)
    root = C.make_empty("PD_Sheet%d" % k, (SHEET_AT[0] + dx + near * math.sin(psi) + r.uniform(-0.0004, 0.0004),
                                           SHEET_AT[1] - near * math.cos(psi) + r.uniform(-0.0004, 0.0004), 0.0), sh.chars, size=0.01)
    root.rotation_euler = (0.0, 0.0, psi)
    slats, bands = sheet_part(theta, tilt, bulge)
    L.part("PD_Sheet%d_slats" % k, slats, sh.chars, sh.mats["p_lantern"], root, smooth=True)
    L.part("PD_Sheet%d_bands" % k, bands, sh.chars, sh.mats["kraft"], root, smooth=True)
    return root


# ---------------------------------------------------------------- the lettered tag (S1)
def tag_bend(u, v, w, h):
    """How far the card stands off its own plane (m, + toward the lens) at u (from the middle) and v (from the foot):
    both ends curl back a millimetre, the top edge waves, and the top right corner was bent back by a thumb."""
    un, vn = 2.0 * u / w, v / h
    s = max(0.0, 0.5 * (un + 1.0) + vn - 1.62)
    return -0.0011 * un * un + 0.0004 * math.sin(2.2 * un + 0.6) * vn - 0.022 * s * s


def tag_part(w, h, clip=0.009, thick=0.00045, nx=36, ny=18, seed=230):
    """The tag as a part with UVs: a grid that follows a knife-cut outline (two clipped corners at the hole end), bent by
    tag_bend, with a back and a rim of its own vertices. Returns ((verts, faces), uv per vertex); UV 0..1 is the whole face."""
    wob = lambda k, x: 0.00028 * K.smooth_noise(seed + k, x / 0.011)
    front, uv = [], []
    for j in range(ny + 1):
        v0 = h * j / ny
        xl = -w / 2 + max(0.0, clip - min(v0, h - v0)) + wob(1, v0)
        xr = w / 2 + wob(2, v0)
        for i in range(nx + 1):
            u = xl + (xr - xl) * i / nx
            v = v0 + (wob(3, u) if j == 0 else wob(4, u) if j == ny else 0.0)
            front.append((u, v, tag_bend(u, v, w, h)))
            uv.append((u / w + 0.5, v / h))
    n, idx = len(front), (lambda i, j: j * (nx + 1) + i)
    verts = front + [(x, y, z - thick) for x, y, z in front]
    faces = [(idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)) for j in range(ny) for i in range(nx)]
    faces += [(n + d, n + c, n + b, n + a) for a, b, c, d in faces[:nx * ny]]
    ring = [idx(i, 0) for i in range(nx)] + [idx(nx, j) for j in range(ny)] + [idx(i, ny) for i in range(nx, 0, -1)] + [idx(0, j) for j in range(ny, 0, -1)]
    m, q = len(verts), len(ring)
    verts += [front[k] for k in ring] + [(front[k][0], front[k][1], front[k][2] - thick) for k in ring]
    faces += [(m + (k + 1) % q, m + k, m + q + k, m + q + (k + 1) % q) for k in range(q)]
    return (verts, faces), uv + uv + [uv[k] for k in ring] * 2


def tag_material(w, h, paper):
    """Cream card with the lettering image (assets/tag.png, made by lettering.hand_lettering) mixed into its colour by
    the image's alpha, a kraft ring round the punched hole, and the hole itself (see-through)."""
    m = PP.paper_material("PD_TagCard", paper, fibre=0.35, fibre_size=0.0015, mottle=0.16, mottle_size=0.014, roughness=0.85, vary=0.0)
    nt = m.node_tree
    new, link = nt.nodes.new, nt.links.new
    b = next(nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED")
    out = next(nd for nd in nt.nodes if nd.type == "OUTPUT_MATERIAL")
    col, surf = b.inputs["Base Color"].links[0].from_socket, out.inputs[0].links[0].from_socket
    tc, img = new("ShaderNodeTexCoord"), new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(TAG_PNG, check_existing=True)
    img.image.reload()
    img.interpolation, img.extension = "Cubic", "CLIP"
    link(tc.outputs["UV"], img.inputs["Vector"])
    vm = []
    for op, second in (("SUBTRACT", (HOLE[0] / w, HOLE[1] / h, 0.0)), ("MULTIPLY", (w, h, 0.0)), ("LENGTH", None)):
        nd = new("ShaderNodeVectorMath")
        nd.operation = op
        link(vm[-1].outputs[0] if vm else tc.outputs["UV"], nd.inputs[0])
        if second:
            nd.inputs[1].default_value = second
        vm.append(nd)
    dist = vm[-1].outputs["Value"]

    def inside(radius):
        nd = new("ShaderNodeMath")
        nd.operation = "LESS_THAN"
        link(dist, nd.inputs[0])
        nd.inputs[1].default_value = radius
        return nd.outputs[0]

    def mix(fac, a, colour):
        nd = new("ShaderNodeMix")
        nd.data_type = "RGBA"
        link(fac, nd.inputs[0])
        link(a, nd.inputs[6])
        if isinstance(colour, tuple):
            nd.inputs[7].default_value = colour
        else:
            link(colour, nd.inputs[7])
        return nd.outputs[2]

    link(mix(img.outputs["Alpha"], mix(inside(HOLE[3]), col, (0.34, 0.20, 0.10, 1.0)), img.outputs["Color"]), b.inputs["Base Color"])
    tp, ms = new("ShaderNodeBsdfTransparent"), new("ShaderNodeMixShader")
    link(inside(HOLE[2]), ms.inputs[0])
    link(surf, ms.inputs[1])
    link(tp.outputs[0], ms.inputs[2])
    link(ms.outputs[0], out.inputs[0])
    return m


def tag(sh):
    """The tag on its folded kraft stand, with tape over the top edge and a string through the hole. Visible on poses
    1 to S1_GONE - 1. Returns the world position of its lettering (the focus point)."""
    p = sh.p
    (w, h), t = p["tag_size"], math.radians(p["tag_lean"])
    root = C.make_empty("PD_Tag", (p["tag_at"][0], p["tag_at"][1], 0.0), sh.env, size=0.01)
    root.rotation_euler = (0.0, 0.0, p["tag_yaw"])
    geometry, uv = tag_part(w, h)
    card = L.part("PD_TagCard", geometry, sh.env, tag_material(w, h, p["tag_paper"]), root, smooth=True)
    card.rotation_euler = (pi / 2 - t, 0.0, 0.0)
    layer = card.data.uv_layers.new(name="UVMap")
    for lp in card.data.loops:
        layer.data[lp.index].uv = uv[lp.vertex_index]
    ox, half, ridge, back = 0.004, 0.031, h + 0.0035, 0.024
    rect = lambda y0, y1, seed: K.hand_cut([(ox - half, y0), (ox + half, y0), (ox + half, y1), (ox - half, y1)], seed, 0.0004, 0.006, 0.02)
    flap = G.card("PD_TagStandFront", rect(0.006, ridge, 231), CARD, sh.env, sh.mats["kraft"], sh.mats["core"], z0=-(0.0016 + CARD))
    flap.parent, flap.rotation_euler = root, (pi / 2 - t, 0.0, 0.0)
    yr, zr = ridge * math.sin(t) + 0.0016 * math.cos(t), ridge * math.cos(t) - 0.0016 * math.sin(t)
    leg = G.card("PD_TagStandBack", rect(0.0, math.hypot(back, zr), 232), CARD, sh.env, sh.mats["kraft"], sh.mats["core"])
    leg.parent, leg.location, leg.rotation_euler = root, (0.0, yr + back, 0.0), (math.atan2(zr, -back), 0.0, 0.0)
    tu = 0.024
    L.tape("PD_TagTape", sh.env, sh.mats, 0.017, 0.010, 233, pi / 2 + 0.13, (tu, h - 0.0015), tag_bend(tu, h, w, h) + 0.00035, card)
    hu, hv = -w / 2 + HOLE[0], HOLE[1]
    zf = max(tag_bend(hu, v, w, h) for v in (0.0, 0.015, hv)) + 0.0004
    strings = (([(hu, hv - 0.0008), (hu - 0.0013, hv - 0.011), (hu - 0.0004, hv - 0.022), (hu + 0.0014, 0.0003)],
                [(hu + 0.0014, 0.0005), (hu + 0.0008, -0.007), (hu - 0.004, -0.0135), (hu - 0.012, -0.0155), (hu - 0.019, -0.011), (hu - 0.0205, -0.004)]),
               ([(hu + 0.0006, hv - 0.001), (hu + 0.0022, hv - 0.012), (hu + 0.0036, hv - 0.023), (hu + 0.0042, 0.0003)],
                [(hu + 0.0042, 0.0005), (hu + 0.007, -0.008), (hu + 0.0135, -0.012), (hu + 0.0215, -0.0098)]))
    for k, (face, on_mat) in enumerate(strings):
        L.part("PD_TagStringFace%d" % k, K.stroke_strip(face, 0.0009, 234 + k, 0.00012, 0.001, zf, 0.15), sh.env, sh.mats["thread"], card)
        L.part("PD_TagStringMat%d" % k, K.stroke_strip(on_mat, 0.0009, 236 + k, 0.00015, 0.001, 0.0005, 0.15), sh.env, sh.mats["thread"], root)
    sh.switch(root, 1, S1_GONE - 1)
    c, s, v = math.cos(p["tag_yaw"]), math.sin(p["tag_yaw"]), 0.026
    lx, ly = 0.004, v * math.sin(t)
    return (p["tag_at"][0] + lx * c - ly * s, p["tag_at"][1] + lx * s + ly * c, v * math.cos(t))


# ---------------------------------------------------------------- the builders
def shot_intro(sh):
    """S1: the set, the flat sheet, the tag, the focus on the lettering while it is there, then on the first lamp."""
    p, n = sh.p, sh.poses
    set_up(sh)
    sheet(sh, 0, *ROLL[0][2:])
    swing(sh, [min(0.0, (q - S1_MATCH) * 2.5) for q in sh.FR])         # the idle swing runs up to the next shot's first pose
    at = tag(sh)
    bpy.context.view_layer.update()
    foc = C.make_empty("TRK_tag", at, sh.trk, size=0.004)
    far = tuple(sh.points["lamp_a"].matrix_world.translation)
    A.bake_vec(foc, "location", sh.FR, [at if q < S1_GONE else far for q in sh.FR], "CONSTANT")
    sh.points["tag"] = foc
    shares = {q: p["after"][q - S1_OFF] for q in (S1_OFF, S1_GONE)}   # the eye has not adapted yet: the blue lamp dims
    shares.update({q: K.flicker(101, n, 0.025)[0] for q in range(S1_MATCH, n + 1)})
    bake_blue(sh, shares)
    wf, warm = K.flicker(102, n, 0.02), sh.lights["warm"]
    A.bake(warm, "energy", sh.FR, [0.0 if (q < S1_ON or q >= S1_OFF) else p["warm"] * (p["warm_flick"] if q == S1_ON else wf[q - 1]) for q in sh.FR], 0, "CONSTANT")


def shot_roll(sh):
    """S2: five replacement shapes of the sheet, each shown for its poses only."""
    set_up(sh)
    for k, (a, b, *shape) in enumerate(ROLL):
        sh.switch(sheet(sh, k, *shape), a, b)
    sh.points["sheet"] = C.make_empty("TRK_sheet", (SHEET_AT[0], SHEET_AT[1], 0.02), sh.trk, size=0.004)
    swing(sh, sh.held(lambda t: t * 30.0))
    bake_blue(sh)


def shot_lamps(sh):
    """S3: the first lamp comes on at pose 3, the second at pose 6 (smaller, quicker flicker); both swing after a kick."""
    set_up(sh)
    light_lamp(sh, "lamp_a", 3)
    light_lamp(sh, "lamp_b", 6, quick=True)
    swing(sh, sh.held(lambda t: t * 30.0), kicks=[(f30(3), 0.05)])
    bake_blue(sh)


BUILDERS = {"S1": shot_intro, "S2": shot_roll, "S3": shot_lamps}
PARAMS = {
    "S1": dict(door_cheat=35.0, warm=0.075, warm_pos=(-1.17, -0.31, 0.30), warm_aim=(-1.33, -0.095, 0.02), warm_spread=50.0,
               warm_flick=0.4, after=(0.25, 0.4), tag_at=(-1.356, -0.105), tag_yaw=-0.07, tag_lean=28.0, tag_size=(0.108, 0.054),
               tag_paper=(0.66, 0.59, 0.43)),
    "S2": dict(door_cheat=35.0),
    "S3": dict(door_cheat=35.0),
}
