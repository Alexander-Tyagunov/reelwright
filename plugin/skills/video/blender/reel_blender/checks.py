"""Measurements used before a full render and after it (Pillow and numpy; no bpy, run in the workspace).

Every function takes a picture as a path, a PIL image or an array, and works on its greyscale (0..255). Regions are
boxes (left, top, right, bottom) in shares of the frame, 0..1 from the top left, so the same box fits any size.

    edge_energy   sharpness: variance of the edge filter after a 5 px median (the median removes grain, which would
                  otherwise raise the number and let a noisy soft frame out-score a clean sharp one)
    brightness    mean of a frame or of a band of it
    match         the same pose from two renders: shift in pixels, brightness ratio, edge energy ratio
    compare_sets  match for a list of frame pairs against tolerances, with a verdict
"""
import numpy as np
from PIL import Image, ImageFilter


def _grey(img):
    """Greyscale PIL image from a path, an image or an array."""
    if isinstance(img, (str, bytes)) or hasattr(img, "__fspath__"):
        img = Image.open(img)
    elif isinstance(img, np.ndarray):
        img = Image.fromarray(np.asarray(img, np.uint8))
    return img.convert("L")


def _crop(g, box):
    if box is None:
        return g
    w, h = g.size
    return g.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))


def edge_energy(img, box=None):
    """Sharpness of a frame (or of a box of it): variance of FIND_EDGES after a 5 px median, border of 4 px left out.
    Compare only frames of the same size and the same region; higher is sharper."""
    g = _crop(_grey(img), box).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.FIND_EDGES)
    return float(np.asarray(g, np.float32)[4:-4, 4:-4].var())


def brightness(img, box=None):
    """Mean grey value 0..255 of a frame, or of a box (for a band: (0, 0.66, 1, 1) is the lower third)."""
    return float(np.asarray(_crop(_grey(img), box), np.float32).mean())


def shift_between(a, b):
    """(dx, dy) in pixels that moves picture b onto picture a, by phase correlation of both greyscale pictures at
    half size (accurate to 2 px; the result is in full-size pixels). (0, 0) means no shift."""
    ga, gb = _grey(a), _grey(b)
    half = (ga.size[0] // 2, ga.size[1] // 2)
    fa, fb = (np.asarray(g.resize(half), np.float32) for g in (ga, gb))
    fa, fb = fa - fa.mean(), fb - fb.mean()
    win = np.outer(np.hanning(fa.shape[0]), np.hanning(fa.shape[1]))
    cross = np.fft.fft2(fa * win) * np.conj(np.fft.fft2(fb * win))
    corr = np.fft.ifft2(cross / (np.abs(cross) + 1e-9)).real
    y, x = np.unravel_index(int(np.argmax(corr)), corr.shape)
    dy, dx = (y - corr.shape[0] if y > corr.shape[0] // 2 else y), (x - corr.shape[1] if x > corr.shape[1] // 2 else x)
    return (2 * int(dx), 2 * int(dy))


def match(a, b):
    """Compare the same pose from two renders of one size. Returns dict(shift=(dx, dy) px, brightness_ratio b / a,
    edge_ratio b / a, mean_a, mean_b, edge_a, edge_b)."""
    ma, mb, ea, eb = brightness(a), brightness(b), edge_energy(a), edge_energy(b)
    return {"shift": shift_between(a, b), "brightness_ratio": round(mb / ma, 4), "edge_ratio": round(eb / ea, 4),
            "mean_a": round(ma, 2), "mean_b": round(mb, 2), "edge_a": round(ea, 2), "edge_b": round(eb, 2)}


def compare_sets(pairs, brightness_tol=0.03, edge_tol=0.05, max_shift=1):
    """match() for each (a, b) path pair against tolerances: a shift of at most max_shift px, brightness within
    brightness_tol and edge energy within edge_tol (shares of a). Returns dict(ok, rows=[dict(match..., ok)])."""
    rows = []
    for a, b in pairs:
        m = match(a, b)
        m["ok"] = (max(abs(m["shift"][0]), abs(m["shift"][1])) <= max_shift and abs(m["brightness_ratio"] - 1.0) <= brightness_tol
                   and abs(m["edge_ratio"] - 1.0) <= edge_tol)
        rows.append(m)
    return {"ok": all(r["ok"] for r in rows), "rows": rows}
