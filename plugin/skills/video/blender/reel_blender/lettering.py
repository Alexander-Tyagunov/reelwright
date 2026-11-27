"""Text as image textures for paper and card in a Blender scene (Pillow and numpy; no bpy, run in the workspace).

Two kinds, both written as a PNG with the ink in RGB and the strokes in alpha, on a transparent ground, so a shader
can mix the image into a paper material by its alpha and the paper keeps its own fibre and light:

    hand_lettering   written by hand: every letter its own size, slant, turn and baseline, on a line that is neither
                     level nor straight; soft strokes that the paper's tooth eats into; uneven pressure
    printed_text     set in type and printed: kerned pairs, optional letter spacing, ink gain, uneven ink, pinholes

Every irregularity comes from a fixed seed, so a re-run gives the same file. A texture covers a whole face of a known
size: `size_mm` is the face, `px_per_mm` the resolution, and all positions are millimetres from the bottom left corner.
Check digits and capitals of a display face before using it for facts: a handwriting face may draw "1M" as "IM".
Both functions return a dict with the file size in pixels and measurements (ink box, line ends or row widths).
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


def font_file(path, cache_dir="/tmp"):
    """A font Pillow can open: .ttf and .otf pass through, a .woff or .woff2 is converted once into cache_dir
    (needs fontTools, and brotli for woff2). Returns the path of the file to use."""
    if path.lower().endswith((".ttf", ".otf")):
        return path
    out = os.path.join(cache_dir, os.path.splitext(os.path.basename(path))[0] + ".ttf")
    if not os.path.isfile(out):
        from fontTools.ttLib import TTFont
        f = TTFont(path)
        f.flavor = None
        f.save(out)
    return out


def noise(shape, cell, seed, blur=0.0):
    """Value noise 0..1 of the given (rows, cols): random cells of `cell` pixels, smoothly enlarged, optionally blurred."""
    rs = np.random.RandomState(seed)
    small = Image.fromarray((rs.uniform(0, 1, (shape[0] // cell + 2, shape[1] // cell + 2)) * 255).astype(np.uint8))
    im = small.resize((shape[1], shape[0]), Image.BICUBIC)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im, dtype=np.float32) / 255.0


def _save(alpha, ink, out_png, proof, paper):
    """Write the RGBA texture (and an optional proof of the ink on a paper colour). Returns the ink box in pixels."""
    rgba = np.zeros(alpha.shape + (4,), dtype=np.uint8)
    rgba[..., :3] = ink
    rgba[..., 3] = (np.clip(alpha, 0.0, 1.0) * 255).astype(np.uint8)
    os.makedirs(os.path.dirname(os.path.abspath(out_png)), exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(out_png)
    if proof:
        card = Image.new("RGB", alpha.shape[::-1], paper)
        card.paste(Image.new("RGB", alpha.shape[::-1], tuple(ink)), (0, 0), Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8)))
        card.save(proof, quality=90)
    ys, xs = np.nonzero(alpha > 0.2)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else (0, 0, 0, 0)


def _stroke(draw, pts, width):
    draw.line(pts, fill=255, width=width, joint="curve")
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x - width / 2, y - width / 2, x + width / 2, y + width / 2), fill=255)


def _arrow(canvas, x, yb, em_px, r):
    """A drawn arrow 1.22 em long at the height of the small letters (shaft that sags, two head strokes). Returns its length."""
    d, w = ImageDraw.Draw(canvas), max(3, int(round(em_px * 0.105)))
    j = lambda a: r.uniform(-a, a) * em_px
    y0, ln = yb - 0.30 * em_px, 1.22 * em_px
    shaft = [(x + ln * t, y0 + 0.035 * em_px * math.sin(math.pi * t) - 0.05 * em_px * t + j(0.008)) for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
    _stroke(d, shaft, w)
    tx, ty = shaft[-1]
    _stroke(d, [(tx - 0.36 * em_px + j(0.02), ty - 0.23 * em_px + j(0.02)), (tx - 0.15 * em_px, ty - 0.08 * em_px), (tx + 0.02 * em_px, ty + 0.005 * em_px)], w)
    _stroke(d, [(tx + 0.015 * em_px, ty - 0.01 * em_px), (tx - 0.13 * em_px, ty + 0.10 * em_px), (tx - 0.30 * em_px + j(0.02), ty + 0.24 * em_px + j(0.02))], w)
    return ln


def _glyph(path, ch, em_px, slant, turn):
    """One letter on its own layer: (image, x of its origin, y of its baseline)."""
    f = ImageFont.truetype(path, max(8, int(round(em_px))))
    pad, base = int(em_px * 0.6), int(em_px * 1.3)
    im = Image.new("L", (int(f.getlength(ch)) + 2 * pad, int(em_px * 2.1)), 0)
    ImageDraw.Draw(im).text((pad, base), ch, font=f, fill=255, anchor="ls")
    im = im.transform(im.size, Image.AFFINE, (1, slant, -slant * base, 0, 1, 0), resample=Image.BICUBIC)
    return im.rotate(turn, resample=Image.BICUBIC, center=(pad, base)), pad, base


def _letter_line(canvas, path, scale, face_h_mm, text, em_mm, left_mm, base_mm, rise_mm, sag_mm, r):
    """Set one line letter by letter on a drifting baseline. Returns where it ends (mm from the left)."""
    em = em_mm * scale
    f0 = ImageFont.truetype(path, int(round(em)))
    total = f0.getlength(text.replace(">", "nn"))
    x = left_mm * scale
    base = lambda px: ((face_h_mm - base_mm) * scale - rise_mm * scale * (px - left_mm * scale) / total
                       + sag_mm * scale * math.sin(2.3 * math.pi * (px - left_mm * scale) / total + 0.7))
    for i, ch in enumerate(text):
        if ch == " ":
            x += f0.getlength(" ") * r.uniform(0.85, 1.2)
        elif ch == ">":
            x += _arrow(canvas, x + 0.05 * em, base(x), em, r) + 0.12 * em
        else:
            size = em * r.uniform(0.965, 1.04)
            im, pad, gb = _glyph(path, ch, size, r.uniform(-0.045, 0.06), r.uniform(-1.6, 1.6))
            yb = base(x) + r.uniform(-0.035, 0.035) * em
            box = (int(round(x - pad)), int(round(yb - gb)))
            region = canvas.crop((box[0], box[1], box[0] + im.size[0], box[1] + im.size[1]))
            canvas.paste(ImageChops.lighter(region, im), box)
            nxt = text[i + 1] if i + 1 < len(text) and text[i + 1] not in " >" else ""
            x += (f0.getlength(ch + nxt) - f0.getlength(nxt) if nxt else f0.getlength(ch)) * size / em + r.uniform(-0.012, 0.022) * em
    return x / scale


def hand_lettering(out_png, font, size_mm, lines, px_per_mm=19.0, ink=(38, 33, 31), seed=1, proof=None, paper=(226, 208, 170)):
    """Write hand lettering as a transparent PNG covering a face of size_mm = (width, height) millimetres.

    font: path of a handwriting face (.ttf, .otf, .woff, .woff2). lines: [(text, em_mm, left_mm, baseline_mm, rise_mm,
    sag_mm)]: the text (a ">" is drawn as an arrow, for faces without one), its em size, its left edge and baseline
    measured from the bottom left corner, how far the line climbs over its length and how far it sags in the middle.
    px_per_mm: texture resolution (19 gives 2048 px across 108 mm). ink: RGB. seed: fixes every irregularity.
    proof: optional JPEG of the ink on a paper colour. Returns dict(size=(w, h) px, line_ends_mm, ink_box_mm
    [left, bottom, right, top], alpha_mean_in_ink)."""
    r, path = random.Random(seed), font_file(font)
    w_px, h_px = int(round(size_mm[0] * px_per_mm)), int(round(size_mm[1] * px_per_mm))
    canvas = Image.new("L", (w_px, h_px), 0)
    ends = [_letter_line(canvas, path, px_per_mm, size_mm[1], *row, r) for row in lines]
    a = np.asarray(canvas.filter(ImageFilter.GaussianBlur(1.6)), dtype=np.float32) / 255.0
    edge = (noise(a.shape, 3, seed + 10) - 0.5) * 0.30 + (noise(a.shape, 9, seed + 11) - 0.5) * 0.14      # eats into the edge of a stroke
    a = np.clip((a + edge - 0.30) / 0.34, 0.0, 1.0)
    a = a * a * (3.0 - 2.0 * a)
    dens = 0.80 + 0.20 * noise(a.shape, 46, seed + 12)                                                    # pressed harder here, lighter there
    tooth = 0.86 + 0.14 * np.clip((noise(a.shape, 2, seed + 13) - 0.22) / 0.4, 0.0, 1.0)                  # specks the pencil skipped
    a = np.clip(a * dens * tooth, 0.0, 1.0)
    x0, y0, x1, y1 = _save(a, ink, out_png, proof, paper)
    return {"size": (w_px, h_px), "line_ends_mm": [round(e, 1) for e in ends],
            "ink_box_mm": [round(x0 / px_per_mm, 1), round((h_px - y1) / px_per_mm, 1), round(x1 / px_per_mm, 1), round((h_px - y0) / px_per_mm, 1)],
            "alpha_mean_in_ink": round(float(a[a > 0.2].mean()), 3) if (a > 0.2).any() else 0.0}


def _advances(text, font, track):
    """x of every character (kerned pair by pair, plus `track` px between letters) and the total width in pixels."""
    xs, x = [], 0.0
    for i, ch in enumerate(text):
        xs.append(x)
        x += (font.getlength(text[i:i + 2]) - font.getlength(text[i + 1]) + track) if i < len(text) - 1 else font.getlength(ch)
    return xs, x


def printed_text(out_png, font, size_mm, lines, px_per_mm=40.0, ink=(24, 22, 22), seed=1, gain_px=5, proof=None, paper=(226, 208, 170)):
    """Write printed text as a transparent PNG covering a face of size_mm = (width, height) millimetres.

    lines: [(text, em_mm, track_em, baseline_mm)]: the text, its em size, letter spacing as a share of the em, and the
    baseline measured from the bottom edge. Each line is centred across the face. Pairs are kerned. gain_px: ink gain
    (odd number of pixels the press thickens every stroke by). The ink lies unevenly: a slow drift, a fine speckle that
    nibbles the edges, a few pinholes; edges stay sharp. Returns dict(size=(w, h) px, rows=[{width_px, baseline_px}],
    ink_box_mm)."""
    w_px, h_px = int(round(size_mm[0] * px_per_mm)), int(round(size_mm[1] * px_per_mm))
    img = Image.new("L", (w_px, h_px), 0)
    dr, rows = ImageDraw.Draw(img), []
    for text, em_mm, track_em, base_mm in lines:
        f = ImageFont.truetype(font_file(font), int(round(em_mm * px_per_mm)))
        xs, width = _advances(text, f, track_em * f.size)
        left, yb = (w_px - width) / 2.0, h_px - base_mm * px_per_mm
        for ch, x in zip(text, xs):
            dr.text((left + x, yb), ch, font=f, fill=255, anchor="ls")
        rows.append({"width_px": round(width), "baseline_px": round(yb)})
    img = img.filter(ImageFilter.MaxFilter(gain_px))
    a = np.asarray(img, np.float32) / 255.0
    fine, slow = noise(a.shape, 1, seed + 1, 0.9), noise(a.shape, 55, seed + 2, 4.0)
    soft = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9)), np.float32) / 255.0
    edge = np.clip((soft + 0.16 * (fine - 0.5) - 0.5) * 3.0 + 0.5, 0.0, 1.0)
    holes = (noise(a.shape, 1, seed + 3, 1.3) > 0.985).astype(np.float32)
    alpha = edge * (0.955 + 0.045 * slow) * (0.985 + 0.05 * (fine - 0.5)) * (1.0 - 0.40 * holes)
    x0, y0, x1, y1 = _save(alpha, ink, out_png, proof, paper)
    return {"size": (w_px, h_px), "rows": rows,
            "ink_box_mm": [round(x0 / px_per_mm, 1), round((h_px - y1) / px_per_mm, 1), round(x1 / px_per_mm, 1), round((h_px - y0) / px_per_mm, 1)]}
