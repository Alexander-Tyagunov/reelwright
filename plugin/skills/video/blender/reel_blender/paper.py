"""Paper and plain materials (bpy). No colours of any film live here: callers pass them in.
Sizes are in metres because paper detail must match the scale the set is built at."""
import bpy


def _put(node, name, value):
    s = node.inputs.get(name)
    if s is not None:
        try:
            s.default_value = value
        except Exception:
            pass
    return s


def _math(nt, op, a, b=None, c=None):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def new_tree(name):
    """New node material with only an output node. Returns (material, node_tree, output_node)."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")


def plain_material(name, color, roughness=0.5, metallic=0.0, emission=0.0, specular=0.5):
    """One Principled surface for the non-paper things on a desk (lacquer, metal, rubber, a far lamp)."""
    m, nt, out = new_tree(name)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    _put(b, "Base Color", tuple(color[:3]) + (1.0,))
    _put(b, "Roughness", roughness)
    _put(b, "Metallic", metallic)
    _put(b, "Specular IOR Level", specular)
    if emission > 0.0:
        _put(b, "Emission Color", tuple(color[:3]) + (1.0,))
        _put(b, "Emission Strength", emission)
    nt.links.new(b.outputs[0], out.inputs[0])
    return m


def paper_material(name, color, translucency=0.0, transmit=None, fibre=0.3, fibre_size=0.003, mottle=0.12,
                   mottle_size=0.04, roughness=0.9, bump=0.3, vary=0.05, attr=None, specular=0.15):
    """Paper or card that is never flat: fibres, slow mottle, a soft bump and a small per-object difference.

    color: linear RGB. translucency 0..1: share of light that passes through as a glow (a lamp behind or inside
    the sheet lights its far side; Cycles and Eevee). transmit: RGB that shadow rays keep when they cross the
    sheet, so a light inside a paper shell still lights the table (None = the sheet casts a full shadow).
    fibre / mottle: strength 0..1 of the fine stretched grain (along object X) and of the slow blotches;
    fibre_size / mottle_size: their size in metres. vary: how far each object using the material departs in
    value and hue (from Object Info > Random), so no two copies match. attr: name of a per-vertex float that
    multiplies the value (every vertex needs it: a missing attribute reads as 0 = black)."""
    m, nt, out = new_tree(name)
    new, link = nt.nodes.new, nt.links.new
    b, tc, oi = new("ShaderNodeBsdfPrincipled"), new("ShaderNodeTexCoord"), new("ShaderNodeObjectInfo")
    rand = oi.outputs["Random"]
    w = _math(nt, "MULTIPLY", rand, 53.0)
    nm = new("ShaderNodeTexNoise")
    nm.noise_dimensions = "4D"
    _put(nm, "Scale", 1.0 / mottle_size); _put(nm, "Detail", 2.0)
    link(tc.outputs["Object"], nm.inputs["Vector"]); link(w, nm.inputs["W"])
    mp = new("ShaderNodeMapping")
    _put(mp, "Scale", (0.12, 1.0, 1.0))
    link(tc.outputs["Object"], mp.inputs["Vector"])
    nf = new("ShaderNodeTexNoise")
    nf.noise_dimensions = "4D"
    _put(nf, "Scale", 1.0 / fibre_size); _put(nf, "Detail", 3.0); _put(nf, "Roughness", 0.65)
    link(mp.outputs[0], nf.inputs["Vector"]); link(w, nf.inputs["W"])
    v = _math(nt, "ADD", _math(nt, "MULTIPLY_ADD", nm.outputs[0], 2.0 * mottle, 1.0 - mottle),
              _math(nt, "ADD", _math(nt, "MULTIPLY_ADD", nf.outputs[0], fibre, -0.5 * fibre),
                    _math(nt, "MULTIPLY_ADD", rand, 2.0 * vary, -vary)))
    if attr:
        at = new("ShaderNodeAttribute")
        at.attribute_name = attr
        v = _math(nt, "MULTIPLY", v, at.outputs[2])
    hsv = new("ShaderNodeHueSaturation")
    _put(hsv, "Color", tuple(color[:3]) + (1.0,))
    link(v, hsv.inputs["Value"])
    link(_math(nt, "MULTIPLY_ADD", rand, 0.4 * vary, 0.5 - 0.2 * vary), hsv.inputs["Hue"])
    col = hsv.outputs[0]
    link(col, b.inputs["Base Color"])
    _put(b, "Roughness", roughness); _put(b, "Specular IOR Level", specular)
    bp = None
    if bump > 0.0:
        bp = new("ShaderNodeBump")
        _put(bp, "Strength", bump); _put(bp, "Distance", fibre_size * 0.3)
        link(_math(nt, "ADD", _math(nt, "MULTIPLY", nf.outputs[0], 0.7), _math(nt, "MULTIPLY", nm.outputs[0], 0.3)),
             bp.inputs["Height"])
        link(bp.outputs[0], b.inputs["Normal"])
    surf = b.outputs[0]
    if translucency > 0.0:
        tr = new("ShaderNodeBsdfTranslucent")
        link(col, tr.inputs["Color"])
        if bp is not None:
            link(bp.outputs[0], tr.inputs["Normal"])
        mx = new("ShaderNodeMixShader")
        mx.inputs[0].default_value = translucency
        link(surf, mx.inputs[1]); link(tr.outputs[0], mx.inputs[2])
        surf = mx.outputs[0]
    if transmit is not None:
        lp, tp, mx = new("ShaderNodeLightPath"), new("ShaderNodeBsdfTransparent"), new("ShaderNodeMixShader")
        _put(tp, "Color", tuple(transmit[:3]) + (1.0,))
        link(lp.outputs["Is Shadow Ray"], mx.inputs[0]); link(surf, mx.inputs[1]); link(tp.outputs[0], mx.inputs[2])
        surf = mx.outputs[0]
    link(surf, out.inputs[0])
    return m
