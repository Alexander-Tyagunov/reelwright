"""Still pictures from a scene: render at a size, then the checks a channel or a thumbnail needs.

render_still_at needs Blender (bpy). The rest is Pillow and runs in the workspace on files that came over from the
Blender machine. Sizes in pixels. The checks exist because small pictures fail in ways a large one hides: a profile
picture is a circle from 24 px, a banner loses its edges on a phone, a watermark sits over any frame.
"""
import os

from PIL import Image, ImageDraw


def render_still_at(scene, path, size, frame=None, preset="cycles_final", develop=None, **overrides):
    """Render one frame of the live scene at size = (width, height) pixels and restore the scene's own size after.

    Foreground render: keep it to a preview preset, or send the frame through the render queue with a job of its own
    (a still at full size is slow). develop: dict for photo.develop. Returns render.render_still's dict."""
    from . import render as R
    r = scene.render
    old = (r.resolution_x, r.resolution_y, r.resolution_percentage)
    r.resolution_x, r.resolution_y = int(size[0]), int(size[1])
    try:
        return R.render_still(scene, path, frame=frame, preset=preset, develop=develop, **overrides)
    finally:
        r.resolution_x, r.resolution_y, r.resolution_percentage = old


def circle(img, size):
    """The picture as a circular avatar shows it: scaled to a square of `size` px and masked to a circle (RGBA)."""
    small = img.resize((size, size), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size * 8, size * 8), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size * 8 - 1, size * 8 - 1], fill=255)
    small.putalpha(mask.resize((size, size), Image.LANCZOS))
    return small


def circle_sheet(src, out_path, sizes=(88, 48, 24), grounds=((15, 15, 15), (255, 255, 255))):
    """Check sheet of a profile picture: the circle at each size in `sizes` on each ground colour, side by side.
    Look at it at 100 %: the smallest must still read as one bold shape. Returns out_path."""
    img = Image.open(src).convert("RGB")
    pw = sum(sizes) + 18 * (len(sizes) + 1)
    sheet = Image.new("RGB", (pw * len(grounds), max(sizes) + 40), grounds[0])
    for k, ground in enumerate(grounds):
        ImageDraw.Draw(sheet).rectangle([pw * k, 0, pw * (k + 1) - 1, sheet.size[1]], fill=ground)
        x = pw * k + 18
        for s in sizes:
            c = circle(img, s)
            sheet.paste(c, (x, sheet.size[1] // 2 - s // 2), c)
            x += s + 18
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    sheet.save(out_path)
    return out_path


def centre_crop(img, size):
    """The crop of `size` = (width, height) px from the middle of the picture (the part a narrow view always shows)."""
    w, h = img.size
    x, y = (w - size[0]) // 2, (h - size[1]) // 2
    return img.crop((x, y, x + size[0], y + size[1]))


def banner_crops(src, out_dir, phone=(1546, 423), desktop=(2560, 423)):
    """Centre crops of a banner for a phone and for a desktop, written to out_dir as banner-phone-WxH.jpg and
    banner-desktop-WxH.jpg. A wider view (a TV) shows the whole picture. Returns the two paths."""
    img = Image.open(src).convert("RGB")
    os.makedirs(out_dir, exist_ok=True)
    out = []
    for name, size in (("phone", phone), ("desktop", desktop)):
        path = os.path.join(out_dir, "banner-%s-%dx%d.jpg" % ((name,) + tuple(size)))
        centre_crop(img, size).save(path, quality=92)
        out.append(path)
    return out


def watermark_cut(src, out_path, size=150, shape="circle", margin=0.0):
    """Cut a watermark: the middle square of the picture scaled to size x size px, transparent outside one simple
    shape ("circle" or "square"); margin (circle only) is the share of the side left clear at the edge. PNG. Check it at 56 px over
    a dark and a light frame. Returns out_path."""
    img = Image.open(src).convert("RGBA")
    side = min(img.size)
    img = centre_crop(img, (side, side)).resize((size, size), Image.LANCZOS)
    if shape == "circle":
        mask = Image.new("L", (size * 8, size * 8), 0)
        m = int(margin * size * 8)
        ImageDraw.Draw(mask).ellipse([m, m, size * 8 - 1 - m, size * 8 - 1 - m], fill=255)
        img.putalpha(mask.resize((size, size), Image.LANCZOS))
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    img.save(out_path, optimize=True)
    return out_path
