"""The two hand-made props of the example film: the flat sheet that rolls itself up, and the lettered tag."""

import math

import bpy

from reel_blender import mesh as G, camera as C, craft as K, paper as PP
import look as L
from desk_set import CARD, HOLE, MM, S1_GONE, SHEET_AT, TAG_PNG, pi

pi = math.pi

# ---------------------------------------------------------------- the flat sheet that rolls itself up (S2)
def sheet_part(theta, tilt, bulge, seed=3):
    """A slit sheet (12 slats between two kraft bands) bent into an arc of `theta` radians (2 pi = closed) about the
    place where
    the lantern will stand, leaning back by `tilt` (pi / 2 = lying flat), slats bowed by `bulge` (0..1). Returns (slats,
    bands)."""
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
                                           SHEET_AT[1] - near * math.cos(psi) + r.uniform(-0.0004, 0.0004), 0.0),
                                           sh.chars, size=0.01)
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
    """The tag as a part with UVs: a grid that follows a knife-cut outline (two clipped corners at the hole end), bent
    by
    tag_bend, with a back and a rim of its own vertices. Returns ((verts, faces), uv per vertex); UV 0..1 is the whole
    face."""
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
    ring = [idx(i, 0) for i in range(nx)] + [idx(nx, j) for j in range(ny)] + [idx(i, ny) for i in range(nx, 0,
            -1)] + [idx(0, j) for j in range(ny, 0, -1)]
    m, q = len(verts), len(ring)
    verts += [front[k] for k in ring] + [(front[k][0], front[k][1], front[k][2] - thick) for k in ring]
    faces += [(m + (k + 1) % q, m + k, m + q + k, m + q + (k + 1) % q) for k in range(q)]
    return (verts, faces), uv + uv + [uv[k] for k in ring] * 2


def tag_material(w, h, paper):
    """Cream card with the lettering image (assets/tag.png, made by lettering.hand_lettering) mixed into its colour by
    the image's alpha, a kraft ring round the punched hole, and the hole itself (see-through)."""
    m = PP.paper_material("PD_TagCard", paper, fibre=0.35, fibre_size=0.0015, mottle=0.16, mottle_size=0.014,
            roughness=0.85, vary=0.0)
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

    link(mix(img.outputs["Alpha"], mix(inside(HOLE[3]), col, (0.34, 0.20, 0.10, 1.0)), img.outputs["Color"]),
            b.inputs["Base Color"])
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
    rect = lambda y0, y1, seed: K.hand_cut([(ox - half, y0), (ox + half, y0), (ox + half, y1), (ox - half, y1)], seed,
            0.0004, 0.006, 0.02)
    flap = G.card("PD_TagStandFront", rect(0.006, ridge, 231), CARD, sh.env, sh.mats["kraft"], sh.mats["core"],
            z0=-(0.0016 + CARD))
    flap.parent, flap.rotation_euler = root, (pi / 2 - t, 0.0, 0.0)
    yr, zr = ridge * math.sin(t) + 0.0016 * math.cos(t), ridge * math.cos(t) - 0.0016 * math.sin(t)
    leg = G.card("PD_TagStandBack", rect(0.0, math.hypot(back, zr), 232), CARD, sh.env, sh.mats["kraft"],
            sh.mats["core"])
    leg.parent, leg.location, leg.rotation_euler = root, (0.0, yr + back, 0.0), (math.atan2(zr, -back), 0.0, 0.0)
    tu = 0.024
    L.tape("PD_TagTape", sh.env, sh.mats, 0.017, 0.010, 233, pi / 2 + 0.13, (tu, h - 0.0015), tag_bend(tu, h, w,
            h) + 0.00035, card)
    hu, hv = -w / 2 + HOLE[0], HOLE[1]
    zf = max(tag_bend(hu, v, w, h) for v in (0.0, 0.015, hv)) + 0.0004
    strings = (([(hu, hv - 0.0008), (hu - 0.0013, hv - 0.011), (hu - 0.0004, hv - 0.022), (hu + 0.0014, 0.0003)],
                [(hu + 0.0014, 0.0005), (hu + 0.0008, -0.007), (hu - 0.004, -0.0135), (hu - 0.012, -0.0155),
                (hu - 0.019, -0.011), (hu - 0.0205, -0.004)]),
               ([(hu + 0.0006, hv - 0.001), (hu + 0.0022, hv - 0.012), (hu + 0.0036, hv - 0.023), (hu + 0.0042,
               0.0003)],
                [(hu + 0.0042, 0.0005), (hu + 0.007, -0.008), (hu + 0.0135, -0.012), (hu + 0.0215, -0.0098)]))
    for k, (face, on_mat) in enumerate(strings):
        L.part("PD_TagStringFace%d" % k, K.stroke_strip(face, 0.0009, 234 + k, 0.00012, 0.001, zf, 0.15), sh.env,
                sh.mats["thread"], card)
        L.part("PD_TagStringMat%d" % k, K.stroke_strip(on_mat, 0.0009, 236 + k, 0.00015, 0.001, 0.0005, 0.15), sh.env,
                sh.mats["thread"], root)
    sh.switch(root, 1, S1_GONE - 1)
    c, s, v = math.cos(p["tag_yaw"]), math.sin(p["tag_yaw"]), 0.026
    lx, ly = 0.004, v * math.sin(t)
    return (p["tag_at"][0] + lx * c - ly * s, p["tag_at"][1] + lx * s + ly * c, v * math.cos(t))
