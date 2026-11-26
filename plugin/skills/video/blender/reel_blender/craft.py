"""Hand-made irregularity from fixed seeds (pure math, no bpy).

Everything a person's hand adds to an object or a move, as numbers: cut edges that wander, pencil strokes,
torn tape ends, pose-to-pose jitter, exposure flicker, an uneven slider push, parts that shift now and then.
The same seed gives the same numbers on every build. Units: metres, radians, poses (one pose = one exposure).
"""
import math
import random
import zlib


def rng(seed, *keys):
    """A random.Random that depends only on (seed, keys)."""
    return random.Random(zlib.crc32(repr((seed,) + keys).encode("utf8")))


def smooth_noise(seed, x):
    """Smooth value noise in -1..1 at position x (one lattice value per unit of x)."""
    i = math.floor(x)
    t = x - i
    t = t * t * (3.0 - 2.0 * t)
    a, b = rng(seed, "n", i).uniform(-1, 1), rng(seed, "n", i + 1).uniform(-1, 1)
    return a + (b - a) * t


def hand_cut(poly, seed, wobble=0.0004, step=0.004, wave=0.02, corner=0.5):
    """Re-cut a counter-clockwise polygon [(x, y)] the way a knife or scissors would.

    Edges longer than `step` are split every `step` metres and pushed off the line by up to `wobble` metres
    (a drift with wavelength `wave` plus a little shake); corners miss by `corner` x wobble.
    Returns the new polygon (more points, same winding)."""
    out, s, n = [], 0.0, len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy)
        if length < 1e-9:
            continue
        nx, ny = dy / length, -dx / length
        m = max(1, int(round(length / step)))
        r = rng(seed, "cut", i)
        for k in range(m):
            t = k / float(m)
            d = wobble * (smooth_noise(seed, (s + length * t) / wave) + 0.25 * r.uniform(-1, 1))
            px, py = a[0] + dx * t + nx * d, a[1] + dy * t + ny * d
            if k == 0:
                px += corner * wobble * r.uniform(-1, 1)
                py += corner * wobble * r.uniform(-1, 1)
            out.append((px, py))
        s += length
    return out


def _catmull2(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return tuple(0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2
                        + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t3) for i in range(2))


def stroke_strip(points, width, seed, wobble=0.0, step=0.001, z=0.0, pressure=0.3, smooth=True):
    """A drawn line (pencil, pen, thread) through [(x, y)] as a flat strip in the XY plane at height z.

    width in metres, varying by `pressure` (0..1) along the stroke and thinning at both ends; `wobble` metres of
    sideways wander. Returns a part (verts, faces) for mesh.new_object; lay it a hair above the paper it is on."""
    pts = [tuple(p[:2]) for p in points]
    dense, n = [], len(pts)
    for i in range(n - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
        m = max(1, int(math.ceil(math.dist(p1, p2) / step)))
        for k in range(m):
            t = k / float(m)
            dense.append(_catmull2(p0, p1, p2, p3, t) if smooth else
                         (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t))
    dense.append(pts[-1])
    verts, s, last = [], 0.0, len(dense) - 1
    for i, p in enumerate(dense):
        a, b = dense[max(i - 1, 0)], dense[min(i + 1, last)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        if i:
            s += math.dist(dense[i - 1], p)
        off = wobble * smooth_noise(seed, s / (step * 12.0))
        ends = min(1.0, 0.4 + 6.0 * min(i, last - i) / max(1.0, float(last)))
        w = 0.5 * width * (1.0 + pressure * smooth_noise(seed + 1, s / (step * 7.0))) * ends
        verts += [(p[0] + nx * (off + w), p[1] + ny * (off + w), z), (p[0] + nx * (off - w), p[1] + ny * (off - w), z)]
    return verts, [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(last)]


def torn_rect(length, width, seed, tooth=0.0006):
    """A piece of tape: a rectangle along X centred on the origin whose two short ends are torn (jagged by
    `tooth` metres). Returns a counter-clockwise polygon."""
    r = rng(seed, "torn")
    n = max(3, int(width / max(tooth, 1e-6)))
    hl, hw = length / 2.0, width / 2.0
    right = [(hl + r.uniform(-tooth, tooth), -hw + width * k / n) for k in range(n + 1)]
    left = [(-hl + r.uniform(-tooth, tooth), hw - width * k / n) for k in range(n + 1)]
    return right + left


def pose_jitter(seed, n, pos=0.0002, rot=0.01, moved=None):
    """What a hand adds each time it touches a puppet: n tuples (dx, dy, dz, rx, ry, rz), metres and radians.

    moved: optional list of bools, one per pose; where False the puppet was not touched and keeps the last
    offsets (an untouched object must not shimmer)."""
    out, cur = [], (0.0,) * 6
    for i in range(n):
        if moved is None or moved[i]:
            r = rng(seed, "pose", i)
            cur = tuple(r.uniform(-pos, pos) for _ in range(3)) + tuple(r.uniform(-rot, rot) for _ in range(3))
        out.append(cur)
    return out


def flicker(seed, n, amp=0.03, slow=0.5, wave=9.0):
    """Light level per exposure: n multipliers around 1 (a slow drift with wavelength `wave` poses plus
    exposure-to-exposure variation), total swing about +-amp."""
    return [1.0 + amp * (slow * smooth_noise(seed, i / wave) + (1.0 - slow) * rng(seed, "flk", i).uniform(-1, 1))
            for i in range(n)]


def hand_slide(seed, n, start, end, error=0.25):
    """Progress 0..1 per pose of a camera pushed along a slider by hand between pose indices start and end:
    eased, with every increment off by up to +-error of itself. Still before `start` and after `end`."""
    m = max(1, end - start)
    ease = lambda u: u * u * (3.0 - 2.0 * u)
    steps = [(ease((k + 1) / float(m)) - ease(k / float(m))) * (1.0 + error * rng(seed, "slide", k).uniform(-1, 1))
             for k in range(m)]
    total, acc, out = sum(steps), 0.0, []
    for i in range(n):
        if start < i <= end:
            acc += steps[i - start - 1] / total
        out.append(0.0 if i <= start else (1.0 if i >= end else min(acc, 1.0)))
    return out


def held(values, hold=2):
    """Hold every `hold`-th value: animation 'on twos' when the scene runs at twice the pose rate."""
    return [values[(i // hold) * hold] for i in range(len(values))]


def shifts(seed, n, at, amp=0.0005):
    """Something that gets knocked now and then (a tab, a fibre, a prop): n (dx, dy) offsets in metres that
    change only at the pose indices in `at` and stay until the next one."""
    out, cur, at = [], (0.0, 0.0), set(at)
    for i in range(n):
        if i in at:
            r = rng(seed, "shift", i)
            cur = (r.uniform(-amp, amp), r.uniform(-amp, amp))
        out.append(cur)
    return out
