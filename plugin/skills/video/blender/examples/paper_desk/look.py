"""The look of the example film: a paper-craft set on a cutting mat under two lamps, shot frame by frame.

This is the one module that holds taste: palette, papers, the dark room, the lamps and the finishing. Everything is
built at true size in metres (lanterns 1 to 2 cm tall), so lens, depth of field and light fall-off behave as on a
table. Every irregularity comes from a fixed seed. film.py asks this module for its materials, its world and its
lights; it knows nothing else about the look.
"""
import math

import bpy
from mathutils import Vector

from reel_blender import mesh as G, camera as C, craft as K, paper as PP, film

MM = 0.001
CARD = 1.5 * MM                      # thickness of cut card
PAL = {                              # linear RGB of the materials a person would have bought
    "mat": (0.012, 0.070, 0.050), "mat_line": (0.42, 0.52, 0.30), "wood": (0.09, 0.05, 0.028),
    "kraft": (0.30, 0.20, 0.115), "core": (0.42, 0.36, 0.28), "ivory": (0.62, 0.57, 0.47),
    "graphite": (0.05, 0.05, 0.055), "tape": (0.72, 0.60, 0.36), "thread": (0.75, 0.74, 0.68),
    "lantern": (0.95, 0.42, 0.10), "tube": (0.92, 0.80, 0.58), "led": (1.0, 0.74, 0.44),
    "blue_lamp": (0.42, 0.58, 1.0), "warm_lamp": (1.0, 0.72, 0.45),
}
PARAMS = dict(lens=40.0, fstop=16.0, exposure=0.8, view_look="Medium High Contrast", world=1.0,
              lamp=1.2, lamp_pos=(-1.80, -0.12, 0.42), lamp_aim=(-1.40, 0.02, 0.0), warm=0.0)
DEVELOP = dict(grain=0.010, vignette=0.12, fringe=0.0, flicker=0.012, fine=True)   # light finishing, per-pixel grain
# overrides of the cycles_final preset
FINAL = dict(samples=64, noise=0.03)


def _mat_grid():
    """Self-healing cutting mat: dark green PVC with a printed 1 cm grid (bold every 5 cm), worn unevenly."""
    m, nt, out = PP.new_tree("PD_Mat")
    new, link, mth = nt.nodes.new, nt.links.new, lambda *a: PP._math(nt, *a)
    b, tc, sep = new("ShaderNodeBsdfPrincipled"), new("ShaderNodeTexCoord"), new("ShaderNodeSeparateXYZ")
    link(tc.outputs["Object"], sep.inputs[0])

    def lines(coord, pitch, width):
        d = mth("ABSOLUTE", mth("SUBTRACT", mth("FRACT", mth("MULTIPLY_ADD", coord, 1.0 / pitch, 0.5)), 0.5))
        return mth("LESS_THAN", d, 0.5 * width / pitch)

    fine = mth("MAXIMUM", lines(sep.outputs[0], 0.01, 0.0004), lines(sep.outputs[1], 0.01, 0.0004))
    bold = mth("MAXIMUM", lines(sep.outputs[0], 0.05, 0.0009), lines(sep.outputs[1], 0.05, 0.0009))
    wear = new("ShaderNodeTexNoise")
    PP._put(wear, "Scale", 14.0)
    PP._put(wear, "Detail", 4.0)
    link(tc.outputs["Object"], wear.inputs["Vector"])
    fac = mth("MULTIPLY", mth("MAXIMUM", mth("MULTIPLY", fine, 0.5), bold), mth("MULTIPLY_ADD", wear.outputs[0], 0.9,
            0.35))
    mix = new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = PAL["mat"] + (1.0,)
    mix.inputs[7].default_value = PAL["mat_line"] + (1.0,)
    link(fac, mix.inputs[0])
    link(mix.outputs[2], b.inputs["Base Color"])
    link(mth("MULTIPLY_ADD", wear.outputs[0], 0.35, 0.30), b.inputs["Roughness"])
    PP._put(b, "Specular IOR Level", 0.35)
    link(b.outputs[0], out.inputs[0])
    return m


def materials(p):
    """The film's materials by key: mat, wood, kraft, core, ivory, tape, graphite, thread, steel, p_lantern and p_tube
    (translucent lantern papers, whose glow share is p['trans'], default 0.20 and 0.25)."""
    pm, pl = PP.paper_material, PP.plain_material
    tr = p.get("trans", {})
    out = {
        "mat": _mat_grid(),
        "wood": pm("PD_Wood", PAL["wood"], fibre=0.9, fibre_size=0.012, mottle=0.25, roughness=0.45, bump=0.1,
        vary=0.0),
        "kraft": pm("PD_Kraft", PAL["kraft"], fibre=0.9, fibre_size=0.002, mottle=0.3, mottle_size=0.02),
        "core": pm("PD_Core", PAL["core"], fibre=0.9, fibre_size=0.0012, mottle=0.3, mottle_size=0.004),
        "ivory": pm("PD_Ivory", PAL["ivory"], fibre=0.3, fibre_size=0.002),
        "tape": pm("PD_Tape", PAL["tape"], fibre=0.7, fibre_size=0.0008, translucency=0.25, roughness=0.6, vary=0.1),
        "graphite": pl("PD_Graphite", PAL["graphite"], roughness=0.35, specular=0.6),
        "thread": pl("PD_Thread", PAL["thread"], roughness=0.9),
        "steel": pl("PD_Steel", (0.60, 0.60, 0.62), roughness=0.32, metallic=1.0),
    }
    for key, glow in (("lantern", tr.get("lantern", 0.20)), ("tube", tr.get("tube", 0.25))):
        c = PAL[key]
        out["p_" + key] = pm("PD_P_" + key, c, translucency=glow, transmit=tuple(0.25 + 0.6 * ch for ch in c),
                fibre=0.35,
                             fibre_size=0.0012, mottle=0.12, mottle_size=0.008, vary=0.03)
    return out


def world(sh):
    """A dark room: almost nothing comes from the 'sky' (strength p['world'])."""
    w = bpy.data.worlds.new("PD_Room")
    sh.scene.world = w
    nt = w.node_tree
    nt.nodes.clear()
    out, bg = nt.nodes.new("ShaderNodeOutputWorld"), nt.nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = (0.010, 0.011, 0.016, 1.0)
    bg.inputs[1].default_value = sh.p["world"]
    nt.links.new(bg.outputs[0], out.inputs[0])


def area(name, coll, pos, aim, size, power, color):
    """A disc-shaped area light at pos aimed at `aim` (metres). Returns the light data (bake its 'energy')."""
    d = bpy.data.lights.new(name, "AREA")
    d.shape, d.size, d.energy, d.color = "DISK", size, power, color
    ob = bpy.data.objects.new(name, d)
    ob.location = pos
    ob.rotation_euler = (Vector(aim) - Vector(pos)).normalized().to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(ob)
    return d


def lights(sh):
    """The clip lamp with its blue gel (sh.lights['lamp']) and, when p['warm'] > 0, a small warm work lamp
    (sh.lights['warm']); a shot's builder bakes their energy. Position, aim and watts come from the shot's
    parameters."""
    p = sh.p
    sh.lights["lamp"] = area("PD_ClipLamp", sh.env, p["lamp_pos"], p["lamp_aim"], 0.12, p["lamp"], PAL["blue_lamp"])
    if p["warm"] > 0.0:
        sh.lights["warm"] = area("PD_WorkLamp", sh.env, p["warm_pos"], p["warm_aim"], 0.05, p["warm"], PAL["warm_lamp"])
        sh.lights["warm"].spread = math.radians(p["warm_spread"])


def part(name, geometry, coll, material, parent, **kw):
    """A mesh object from a (verts, faces) part, parented to `parent`."""
    ob = G.new_object(name, geometry, coll, material, **kw)
    ob.parent = parent
    return ob


def tape(name, coll, mats, length, width, seed, ang=0.0, at=(0.0, 0.0), z=0.0001, parent=None):
    """A torn piece of masking tape lying in the XY plane of `parent` (or the world), turned by ang radians."""
    c, s = math.cos(ang), math.sin(ang)
    poly = [(x * c - y * s + at[0], x * s + y * c + at[1]) for x, y in K.torn_rect(length, width, seed, 0.0007)]
    ob = G.new_object(name, G.prism(poly, z, z + 0.00013), coll, mats["tape"])
    ob.parent = parent
    return ob


def register(name, project, plan, builders, shot_params=None):
    """Register the example film with film.py: this look and the given builders. Returns the shot ids."""
    return film.register(name, project, plan, film.Look(materials, world, lights, PARAMS, DEVELOP, FINAL, prefix="PD"),
                         builders, shot_params)
