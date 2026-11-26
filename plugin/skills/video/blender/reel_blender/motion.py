"""Pure-math motion helpers. No bpy: usable and testable outside Blender.

Units: metres, frames (not seconds) unless a name says otherwise, radians.
Every function is a pure function of its arguments, so the same call always
gives the same animation: bake the results to keyframes with reel_blender.anim.
"""
import bisect
import math


def clamp(x, lo=0.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x


def lerp(a, b, t):
    return a + (b - a) * t


def lerp3(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def smoothstep(e0, e1, x):
    """0 below e0, 1 above e1, smooth in between."""
    if e0 == e1:
        return 0.0 if x < e0 else 1.0
    t = clamp((x - e0) / (e1 - e0))
    return t * t * (3.0 - 2.0 * t)


def ease_in(t, p=2.0):
    return clamp(t) ** p


def ease_out(t, p=2.0):
    return 1.0 - (1.0 - clamp(t)) ** p


def ease_in_out(t, p=2.0):
    t = clamp(t)
    return 0.5 * (2.0 * t) ** p if t < 0.5 else 1.0 - 0.5 * (2.0 * (1.0 - t)) ** p


def ease_out_back(t, s=1.70158):
    """0..1 with an overshoot past 1 before settling (s sets how far)."""
    t = clamp(t) - 1.0
    return t * t * ((s + 1.0) * t + s) + 1.0


def damped_cos(t, freq, decay):
    """exp(-decay*t)*cos(2*pi*freq*t) for t >= 0 (t in frames, freq in cycles/frame); 0 before."""
    if t < 0:
        return 0.0
    return math.exp(-decay * t) * math.cos(2.0 * math.pi * freq * t)


def interp_keys(keys, f, ease=None):
    """Value at frame f from sorted [(frame, value)] keys; value is a float or a tuple.

    Holds the first/last value outside the range; smoothstep between keys unless
    `ease` (a 0..1 -> 0..1 function) is given.
    """
    if f <= keys[0][0]:
        return keys[0][1]
    if f >= keys[-1][0]:
        return keys[-1][1]
    for (f0, v0), (f1, v1) in zip(keys, keys[1:]):
        if f0 <= f <= f1:
            t = (f - f0) / float(f1 - f0) if f1 != f0 else 1.0
            t = ease(t) if ease else t * t * (3.0 - 2.0 * t)
            if isinstance(v0, (tuple, list)):
                return tuple(a + (b - a) * t for a, b in zip(v0, v1))
            return v0 + (v1 - v0) * t
    return keys[-1][1]


def _norm(v):
    d = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return (v[0] / d, v[1] / d, v[2] / d) if d > 1e-12 else (0.0, 0.0, 0.0)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return tuple(
        0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
        for a, b, c, d in zip(p0, p1, p2, p3)
    )


class Path:
    """Smooth path through control points (2D or 3D, metres), addressed by arc length s.

    eps: tangents are measured over a chord of +-eps metres (0.08 suits a set tens of metres across; pass
    about 1% of the path length for a table-top set, or headings are averaged over the whole curve).
    at(s) position; tangent(s) unit direction; heading(s) yaw about Z in radians;
    left(s) unit vector to the left of travel in the XY plane; offset(s, lateral, dz).
    """

    def __init__(self, points, samples_per_span=24, eps=0.08):
        self.eps = eps  # half-length (m) of the chord that tangent() and heading() measure; scale it with the set
        pts = [tuple(float(c) for c in p) + (0.0,) * (3 - len(p)) for p in points]
        n = len(pts)
        dense, self._ctrl = [], []
        for i in range(n - 1):
            p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
            self._ctrl.append(len(dense))
            for k in range(samples_per_span):
                dense.append(_catmull(p0, p1, p2, p3, k / float(samples_per_span)))
        self._ctrl.append(len(dense))
        dense.append(pts[-1])
        cum = [0.0]
        for a, b in zip(dense, dense[1:]):
            cum.append(cum[-1] + math.dist(a, b))
        self._pts, self._cum, self.length = dense, cum, cum[-1]

    def s_at_control(self, i):
        """Arc length (m) at control point i."""
        return self._cum[self._ctrl[i]]

    def at(self, s):
        s = clamp(s, 0.0, self.length)
        j = min(bisect.bisect_right(self._cum, s) - 1, len(self._pts) - 2)
        seg = self._cum[j + 1] - self._cum[j]
        t = (s - self._cum[j]) / seg if seg > 1e-12 else 0.0
        return lerp3(self._pts[j], self._pts[j + 1], t)

    def tangent(self, s, eps=None):
        eps = self.eps if eps is None else eps
        a, b = self.at(s - eps), self.at(s + eps)
        return _norm((b[0] - a[0], b[1] - a[1], b[2] - a[2]))

    def heading(self, s):
        t = self.tangent(s)
        return math.atan2(t[1], t[0])

    def left(self, s):
        t = self.tangent(s)
        return _norm((-t[1], t[0], 0.0))

    def offset(self, s, lateral=0.0, dz=0.0):
        p, n = self.at(s), self.left(s)
        return (p[0] + n[0] * lateral, p[1] + n[1] * lateral, p[2] + dz)

    def samples(self, step=0.5):
        """Points every `step` metres along the path."""
        n = max(1, int(self.length / step))
        return [self.at(self.length * i / n) for i in range(n + 1)]


class Hop:
    """One hop: leaves the ground at frame f0, lands at f0+dur.

    s0 -> s1 distance along a Path (m), height apex above ground (m),
    lat0 -> lat1 lateral offset from the path (m, + is left of travel),
    impact scales crouch / stretch / landing squash for this hop.
    """

    def __init__(self, f0, dur, s0, s1, height, lat0=0.0, lat1=None, impact=1.0):
        self.f0, self.dur, self.s0, self.s1, self.height = f0, dur, s0, s1, height
        self.lat0 = lat0
        self.lat1 = lat0 if lat1 is None else lat1
        self.impact = impact


class HopTrack:
    """A sequence of hops with anticipation, stretch, landing squash and a damped settle.

    Weight is set by the parameters: a heavy body gets a long `anticipation` (frames),
    deep `crouch` and `land_squash` (fractions of height), a low `settle_freq`
    (cycles/frame) and low `settle_decay`; a light one the opposite.
    sample(f) -> dict(s, lat, z, squash, pitch, air): z is height above ground (m),
    squash the vertical scale factor (scale XY by 1/sqrt(squash) to keep volume),
    pitch the forward lean in radians.
    """

    def __init__(self, hops, anticipation=4, crouch=0.18, stretch=0.14, land_squash=0.24,
                 settle_freq=0.12, settle_decay=0.25, lean=0.18):
        self.hops = sorted(hops, key=lambda h: h.f0)
        self.anticipation, self.crouch, self.stretch = anticipation, crouch, stretch
        self.land_squash, self.settle_freq, self.settle_decay, self.lean = land_squash, settle_freq, settle_decay, lean

    def sample(self, f):
        hops = self.hops
        s, lat, z, dev, pitch, air = hops[0].s0, hops[0].lat0, 0.0, 0.0, 0.0, None
        for h in hops:
            if f >= h.f0 + h.dur:
                s, lat = h.s1, h.lat1
            elif f >= h.f0:
                air = h
        if air is not None:
            u = (f - air.f0) / float(air.dur)
            s, lat = lerp(air.s0, air.s1, u), lerp(air.lat0, air.lat1, u)
            z = 4.0 * air.height * u * (1.0 - u)
            late = 1.0 if u < 0.5 else 0.6
            dev = self.stretch * air.impact * abs(1.0 - 2.0 * u) ** 1.5 * late
            pitch = self.lean * (1.0 - 2.0 * u) * late
        else:
            for h in hops:
                a = f - (h.f0 - self.anticipation)
                if 0 <= a < self.anticipation:
                    e = ease_in_out((a + 1.0) / self.anticipation)
                    dev -= self.crouch * h.impact * e
                    pitch -= 0.35 * self.lean * e
                t = f - (h.f0 + h.dur)
                if t >= 0:
                    d = damped_cos(t, self.settle_freq, self.settle_decay) * h.impact
                    dev -= self.land_squash * d
                    pitch -= 0.5 * self.lean * d
        return {"s": s, "lat": lat, "z": z, "squash": clamp(1.0 + dev, 0.45, 1.7), "pitch": pitch,
                "air": air is not None}


def simulate_chain(anchors, n_points, seg_len, fps=30.0, gravity=(0.0, 0.0, -2.0), drag=0.06,
                   wind=None, ground_z=None, friction=0.5, substeps=4, iterations=8,
                   init=None, init_prev=None, lay_dir=(-1.0, 0.0, -0.3), preroll=0):
    """Deterministic rope / ribbon simulation (Verlet), to be baked to keyframes.

    anchors: [(x, y, z)] per frame for the first chain point (m). n_points chain points,
    seg_len metres apart. gravity and wind(time_in_frames, point_index) -> (ax, ay, az) in m/s^2.
    drag: fraction of velocity lost per substep (high = paper in air). ground_z: floor height or None.
    init / init_prev: start positions (and the positions one frame earlier) to continue another chain.
    preroll: frames simulated at the first anchor before frame 0 to let the chain settle.
    Returns one list of n_points (x, y, z) per frame.
    """
    dt2 = (1.0 / (fps * substeps)) ** 2
    a0 = anchors[0]
    if init is None:
        d = _norm(lay_dir)
        pos = [[a0[0] + d[0] * seg_len * i, a0[1] + d[1] * seg_len * i, a0[2] + d[2] * seg_len * i]
               for i in range(n_points)]
    else:
        pos = [list(p) for p in init]
    prev = [list(p) for p in (init_prev if init_prev is not None else pos)]
    keep = 1.0 - drag
    frames = [a0] * preroll + list(anchors)
    last = frames[0]
    out = []
    for fi, anc in enumerate(frames):
        for sub in range(substeps):
            t = (sub + 1.0) / substeps
            time_f = fi - preroll + t
            for i in range(1, n_points):
                p, q = pos[i], prev[i]
                ax, ay, az = gravity
                if wind is not None:
                    w = wind(time_f, i)
                    ax, ay, az = ax + w[0], ay + w[1], az + w[2]
                nx = p[0] + (p[0] - q[0]) * keep + ax * dt2
                ny = p[1] + (p[1] - q[1]) * keep + ay * dt2
                nz = p[2] + (p[2] - q[2]) * keep + az * dt2
                q[0], q[1], q[2] = p[0], p[1], p[2]
                p[0], p[1], p[2] = nx, ny, nz
            p0 = pos[0]
            p0[0], p0[1], p0[2] = lerp(last[0], anc[0], t), lerp(last[1], anc[1], t), lerp(last[2], anc[2], t)
            for _ in range(iterations):
                for i in range(1, n_points):
                    a, b = pos[i - 1], pos[i]
                    dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
                    d = math.sqrt(dx * dx + dy * dy + dz * dz)
                    if d < 1e-9:
                        continue
                    k = (d - seg_len) / d
                    if i == 1:
                        b[0] -= dx * k; b[1] -= dy * k; b[2] -= dz * k
                    else:
                        k *= 0.5
                        a[0] += dx * k; a[1] += dy * k; a[2] += dz * k
                        b[0] -= dx * k; b[1] -= dy * k; b[2] -= dz * k
                if ground_z is not None:
                    for i in range(1, n_points):
                        p = pos[i]
                        if p[2] < ground_z:
                            p[2] = ground_z
                            q = prev[i]
                            q[0] = lerp(q[0], p[0], friction)
                            q[1] = lerp(q[1], p[1], friction)
        last = anc
        if fi >= preroll:
            out.append([tuple(p) for p in pos])
    return out


def ribbon_strip(chain_frames, width, taper=0.5, twist=None, up=(0.0, 0.0, 1.0)):
    """Turn chain frames into ribbon vertices: two per chain point, per frame.

    width in metres at the anchor, narrowing by `taper` (0..1) toward the free end.
    twist(frame_index, point_index) -> radians rolls the ribbon about its length.
    Vertex order per frame: [p0 - w, p0 + w, p1 - w, p1 + w, ...]; faces are
    (2i, 2i+1, 2i+3, 2i+2) (see ribbon_faces).
    """
    out = []
    for fi, pts in enumerate(chain_frames):
        n = len(pts)
        verts, last_w = [], None
        for i in range(n):
            a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
            t = _norm((b[0] - a[0], b[1] - a[1], b[2] - a[2]))
            w = _cross(t, up)
            if w[0] * w[0] + w[1] * w[1] + w[2] * w[2] < 1e-6:
                w = last_w or (0.0, 1.0, 0.0)
            w = _norm(w)
            if last_w is not None and w[0] * last_w[0] + w[1] * last_w[1] + w[2] * last_w[2] < 0:
                w = (-w[0], -w[1], -w[2])
            last_w = w
            if twist is not None:
                ang = twist(fi, i)
                nrm = _cross(w, t)
                c, s_ = math.cos(ang), math.sin(ang)
                w = (w[0] * c + nrm[0] * s_, w[1] * c + nrm[1] * s_, w[2] * c + nrm[2] * s_)
            hw = 0.5 * width * (1.0 - taper * (i / float(max(n - 1, 1))) ** 2)
            p = pts[i]
            verts.append((p[0] - w[0] * hw, p[1] - w[1] * hw, p[2] - w[2] * hw))
            verts.append((p[0] + w[0] * hw, p[1] + w[1] * hw, p[2] + w[2] * hw))
        out.append(verts)
    return out


def ribbon_faces(n_points):
    """Quad faces for ribbon_strip vertices."""
    return [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(n_points - 1)]
