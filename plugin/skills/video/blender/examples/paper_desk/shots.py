"""Shot builders of the example film (S1 intro, S2 sheet, S3 lamps) and their parameters; the set and the props
are in desk_set.py and sheet_tag.py."""

import bpy

from reel_blender import anim as A, camera as C, craft as K
from desk_set import ROLL, S1_GONE, S1_MATCH, S1_OFF, S1_ON, SHEET_AT, bake_blue, f30, light_lamp, set_up, swing
from sheet_tag import sheet, tag

# ---------------------------------------------------------------- the builders
def shot_intro(sh):
    """S1: the set, the flat sheet, the tag, the focus on the lettering while it is there, then on the first lamp."""
    p, n = sh.p, sh.poses
    set_up(sh)
    sheet(sh, 0, *ROLL[0][2:])
    # the idle swing runs up to the next shot's first pose
    swing(sh, [min(0.0, (q - S1_MATCH) * 2.5) for q in sh.FR])
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
    on = [0.0 if (q < S1_ON or q >= S1_OFF) else p["warm"] * (p["warm_flick"] if q == S1_ON else wf[q - 1])
          for q in sh.FR]
    A.bake(warm, "energy", sh.FR, on, 0, "CONSTANT")


def shot_roll(sh):
    """S2: five replacement shapes of the sheet, each shown for its poses only."""
    set_up(sh)
    for k, (a, b, *shape) in enumerate(ROLL):
        sh.switch(sheet(sh, k, *shape), a, b)
    sh.points["sheet"] = C.make_empty("TRK_sheet", (SHEET_AT[0], SHEET_AT[1], 0.02), sh.trk, size=0.004)
    swing(sh, sh.held(lambda t: t * 30.0))
    bake_blue(sh)


def shot_lamps(sh):
    """S3: the first lamp comes on at pose 3, the second at pose 6 (smaller, quicker flicker); both swing after a
    kick."""
    set_up(sh)
    light_lamp(sh, "lamp_a", 3)
    light_lamp(sh, "lamp_b", 6, quick=True)
    swing(sh, sh.held(lambda t: t * 30.0), kicks=[(f30(3), 0.05)])
    bake_blue(sh)


BUILDERS = {"S1": shot_intro, "S2": shot_roll, "S3": shot_lamps}
PARAMS = {
    "S1": dict(door_cheat=35.0, warm=0.075, warm_pos=(-1.17, -0.31, 0.30), warm_aim=(-1.33, -0.095, 0.02),
    warm_spread=50.0,
               warm_flick=0.4, after=(0.25, 0.4), tag_at=(-1.356, -0.105), tag_yaw=-0.07, tag_lean=28.0,
               tag_size=(0.108, 0.054),
               tag_paper=(0.66, 0.59, 0.43)),
    "S2": dict(door_cheat=35.0),
    "S3": dict(door_cheat=35.0),
}
