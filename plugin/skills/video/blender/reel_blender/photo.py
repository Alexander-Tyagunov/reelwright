"""What a real camera adds to a frame, applied to the rendered file (bpy + numpy): a soft vignette, a little
colour fringing toward the corners, exposure flicker and sensor grain that is different on every exposure.
Use it only for looks that are meant to read as photographed; keep every amount small."""
import bpy


def _zoom(ch, s, xx, yy, cx, cy):
    import numpy as np
    h, w = ch.shape
    sx = np.clip(cx + (xx - cx) / s, 0.0, w - 1.001)
    sy = np.clip(cy + (yy - cy) / s, 0.0, h - 1.001)
    x0, y0 = sx.astype(np.int32), sy.astype(np.int32)
    fx, fy = sx - x0, sy - y0
    return (ch[y0, x0] * (1 - fx) * (1 - fy) + ch[y0, x0 + 1] * fx * (1 - fy)
            + ch[y0 + 1, x0] * (1 - fx) * fy + ch[y0 + 1, x0 + 1] * fx * fy)


def develop(src, dst=None, seed=0, grain=0.03, vignette=0.2, fringe=0.001, flicker=0.0, quality=95):
    """Read image `src`, add lens and sensor faults, write JPEG `dst` (default: over src).

    seed: use the frame number, so grain and flicker change per exposure and repeat on a re-render.
    grain: noise strength in display values (0.03 is visible but quiet; stronger in shadows, 1-2 px clumps).
    vignette: share of light lost in the far corners. fringe: red/blue scale difference (0.001 = about a
    pixel at the edge of a 1920 frame). flicker: +-share of exposure variation between frames."""
    import numpy as np
    img = bpy.data.images.load(src, check_existing=False)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    rgb = a.reshape(h, w, 4)[..., :3].copy()
    rs = np.random.RandomState((int(seed) * 7919 + 13) & 0x7FFFFFFF)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    r2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / (cx * cx + cy * cy)
    if fringe:
        rgb[..., 0] = _zoom(rgb[..., 0], 1.0 + fringe, xx, yy, cx, cy)
        rgb[..., 2] = _zoom(rgb[..., 2], 1.0 - fringe, xx, yy, cx, cy)
    if vignette:
        rgb *= (1.0 - vignette * r2 ** 1.3)[..., None]
    if flicker:
        rgb *= 1.0 + flicker * rs.uniform(-1.0, 1.0)
    if grain:
        n = rs.normal(0.0, 1.0, (h, w)).astype(np.float32)
        n = (n + np.roll(n, 1, 0) + np.roll(n, 1, 1) + np.roll(n, (1, 1), (0, 1))) * 0.5
        lum = np.clip(rgb.mean(-1), 0.0, 1.0)
        amp = grain * (1.15 - 0.8 * lum)
        chroma = rs.normal(0.0, 0.35, (h, w, 3)).astype(np.float32)
        rgb += (n[..., None] + chroma) * amp[..., None]
    out = np.ones((h, w, 4), dtype=np.float32)
    out[..., :3] = np.clip(rgb, 0.0, 1.0)
    dst = dst or src
    im = bpy.data.images.new("rb_develop", w, h, alpha=False)
    im.pixels.foreach_set(out.ravel())
    im.filepath_raw = dst
    im.file_format = "JPEG"
    try:
        im.save(quality=int(quality))
    except TypeError:
        im.save()
    bpy.data.images.remove(im)
    return dst
