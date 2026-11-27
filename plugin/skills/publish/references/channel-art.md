# Channel art: banner, profile picture, watermark

Channel art is made like the film: stills rendered in Blender in the film's own look, with real materials and
light, and the title only. The first channel's flat vector art (a dark field, one accent colour, a monospace
title, a glow) was called "a bit AIish"; the same idea photographed (card, pencil, pins, a typeset title card on
the desk) was accepted. A tagline under the title was dropped: "let's have just title and call it a day".

Sizes were checked on YouTube on 27 November 2026. Search the web for the current sizes and crops before you
render; they change. `video/` below is the video skill's `references/` folder
(`${CLAUDE_SKILL_DIR}/../video/references/` from the publish skill).

## Sizes and crops (checked 27 November 2026)

| Piece | File | Size | Shown as | Checks |
|---|---|---|---|---|
| Banner | `channel/banner.jpg` | 2560 x 1440, under 6 MB | phones: the centre 1546 x 423; desktop: the centre strip 2560 x 423; TVs: all of it | everything that matters inside the phone crop with 60 px of margin |
| Profile picture | `channel/profile.png` | 800 x 800 | a circle, from 24 px up | one bold shape; legible as a circle at 88, 48 and 24 px on dark and on white |
| Watermark | `channel/watermark.png` | 150 x 150, transparent outside the shape | over the corner of every video | one simple shape that carries its own ground; legible at 56 px over a dark and a light frame |

## How to make them

Use the film skill's setup (the Blender tool, the layout, `video/blender.md`). One Blender scene can serve all
three: a flat lay or a small set built from the film's own look module and materials.

1. **Lay out in pixels before building.** A top-down lens is a pure scale: work out pixels per metre for the
   banner, then place the phone safe area (1546 x 423 minus 60 px each side) on the set, and put the title and the
   main object inside it. Desktop and TV show more of the same set around it, so the outer area holds the
   film's world, not empty colour.
2. **The title as part of the set.** A printed or hand-lettered card: `lettering.printed_text` or
   `lettering.hand_lettering`, run in the workspace (they need Pillow and the font file), write an image with the
   ink in its alpha; mix it into the card's paper material by that alpha (`video/blender.md`, section 13). Printed black needs an ink
   alpha of 0.95 to 1.0, or it reads as grey. Use the profile's fixed title face if there is one; check digits and
   capitals of a display face before using it.
3. **Light for a flat lay.** Seen from straight above, thickness shows only through shadows: keep the lamp low
   (about 37 degrees up) and let loose pieces ride up a millimetre or more. Flat metal mirrors whatever is
   overhead: give the room a soft source above the camera. Details: `video/handmade.md`, section 6.
4. **Render** at the final size: a preview with `stills.render_still_at(scene, path, size, ...)` (under 60 s at
   preview settings), the final still through the render queue as a job of its own, with the film's finishing
   pass (`video/blender.md`, section 14). A 2560 x 1440 still at 256 samples took 32 to 38 s. Check free disk space
   first (`film.disk_free_mb()`): a still once failed with a full disk while the queue reported an ordinary exit.
5. **The profile picture** is one bold shape from the film (a character, a lamp), shot straight on against a
   plain ground from the same set, not a crop of the banner.
6. **The watermark** is cut from a render of one shape with `stills.watermark_cut(src, out, size, shape)`, with the
   shape's own ground so it reads over any frame.

## The checks, as images you open

Make each in the workspace from the rendered files, save it in `channel/checks/`, and open it.
`stills.banner_crops(src, out_dir)` writes the phone and desktop crops; `stills.circle_sheet(src, out)` the profile
circles; the watermark check is two frames of the film with the watermark laid over at 56 px (ffmpeg `overlay`).
- `banner-phone.jpg`: the centre 1546 x 423 crop with the 60 px margin drawn. Nothing important outside it.
- `banner-desktop.jpg`: the centre 2560 x 423 strip.
- `profile-circles.jpg`: the profile picture as circles at 88, 48 and 24 px, on dark and on white.
- `watermark-56.jpg`: the watermark at 56 px over a dark and a light frame of the film.
- File sizes: banner under 6 MB (`ls -l`).

Show the owner the check images together with the full ones. Done when all four checks have been opened and
pass, and he has seen them. Uploading the art and changing the channel is his to do.
