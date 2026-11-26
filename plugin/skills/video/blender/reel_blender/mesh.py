"""Build meshes from python data. A 'part' is (verts, faces): verts [(x, y, z)] in metres,
faces tuples of vertex indices. Parts are combined with merge() and become objects with new_object()."""
import math

import bmesh
import bpy
from mathutils import Vector


def revolve(profile, segments=32, cap_bottom=True, cap_top=True):
    """Surface of revolution about Z from a profile [(radius, z)] listed bottom to top."""
    verts, faces = [], []
    for r, z in profile:
        for k in range(segments):
            a = 2.0 * math.pi * k / segments
            verts.append((r * math.cos(a), r * math.sin(a), z))
    n = len(profile)
    for j in range(n - 1):
        for k in range(segments):
            k2 = (k + 1) % segments
            faces.append((j * segments + k, j * segments + k2, (j + 1) * segments + k2, (j + 1) * segments + k))
    if cap_bottom:
        faces.append(tuple(reversed(range(segments))))
    if cap_top:
        faces.append(tuple(range((n - 1) * segments, n * segments)))
    return verts, faces


def loft(rings, closed=True, cap=True):
    """Skin between successive rings (each a list of the same number of points)."""
    m = len(rings[0])
    verts = [tuple(p) for ring in rings for p in ring]
    faces = []
    for j in range(len(rings) - 1):
        for k in range(m if closed else m - 1):
            k2 = (k + 1) % m
            faces.append((j * m + k, j * m + k2, (j + 1) * m + k2, (j + 1) * m + k))
    if cap and closed:
        faces.append(tuple(reversed(range(m))))
        faces.append(tuple(range((len(rings) - 1) * m, len(rings) * m)))
    return verts, faces


def prism(poly_xy, z0, z1):
    """Extrude a counter-clockwise polygon [(x, y)] from z0 up to z1."""
    n = len(poly_xy)
    verts = [(x, y, z0) for x, y in poly_xy] + [(x, y, z1) for x, y in poly_xy]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return verts, faces


def box(size, center=(0.0, 0.0, 0.0)):
    """Axis-aligned box of size (sx, sy, sz) centred on `center`."""
    hx, hy = size[0] / 2.0, size[1] / 2.0
    cx, cy, cz = center
    return prism([(cx - hx, cy - hy), (cx + hx, cy - hy), (cx + hx, cy + hy), (cx - hx, cy + hy)],
                 cz - size[2] / 2.0, cz + size[2] / 2.0)


def torus(major, minor, seg_major=24, seg_minor=8):
    """Torus in the XY plane (rotate with transform())."""
    rings = []
    for i in range(seg_major):
        a = 2.0 * math.pi * i / seg_major
        ring = []
        for j in range(seg_minor):
            b = 2.0 * math.pi * j / seg_minor
            r = major + minor * math.cos(b)
            ring.append((r * math.cos(a), r * math.sin(a), minor * math.sin(b)))
        rings.append(ring)
    rings.append(rings[0])
    return loft(rings, closed=True, cap=False)


def transform(part, matrix):
    """Return the part with every vertex multiplied by a mathutils.Matrix."""
    verts, faces = part
    return [tuple(matrix @ Vector(v)) for v in verts], faces


def merge(parts):
    """Join parts into one part."""
    verts, faces = [], []
    for v, f in parts:
        off = len(verts)
        verts.extend(v)
        faces.extend(tuple(i + off for i in face) for face in f)
    return verts, faces


def new_object(name, part, collection=None, material=None, smooth=False, fix_normals=False, smooth_angle=None):
    """Create a mesh object from a part and link it (default: the scene collection).

    smooth=True shades everything smooth; smooth_angle (radians) shades smooth but keeps edges
    sharper than that angle crisp (curved lofts with hard corners). fix_normals recalculates
    outward normals for closed parts."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in part[0]], [], [tuple(f) for f in part[1]])
    if fix_normals or smooth_angle is not None:
        bm = bmesh.new()
        bm.from_mesh(me)
        if fix_normals:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if smooth_angle is not None:
            for e in bm.edges:
                if len(e.link_faces) != 2 or e.calc_face_angle(0.0) > smooth_angle:
                    e.smooth = False
        bm.to_mesh(me)
        bm.free()
    if smooth or smooth_angle is not None:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.update()
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if material is not None:
        me.materials.append(material)
    return ob


def set_point_attribute(mesh, name, values):
    """Store one float per vertex as attribute `name` (read it with an Attribute node)."""
    attr = mesh.attributes.get(name) or mesh.attributes.new(name, "FLOAT", "POINT")
    attr.data.foreach_set("value", list(values))
    return attr
