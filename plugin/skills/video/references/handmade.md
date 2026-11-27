# Handmade: making a render read as made by a person

Use this when the owner says a 3D shot looks generic, clean or "AI". Read `blender.md` first (file flow, the
60-second rule, the library). Worked example: film `claude-timeline`, shot `shot-claude3-desk`
(scripts `ct_desk_look.py`, `shot_claude3_desk.py`): a paper-craft set on a cutting mat, shot frame by frame.

## 1. Answer the maker question before designing anything
Write five answers at the top of the look script. Every later choice is checked against them.
1. Who made this? (One person at a desk at night; a class of children; a model shop.)
2. With what? Name the real materials and tools: kraft card, sugar paper, tissue, tracing paper, masking tape,
   sewing thread, a craft knife, a pencil, LED tea lights.
3. On what surface, at what size? Build at true size in metres (lanterns 3-7 cm). Lens, depth of field and
   light fall-off then behave as on a table without any faking.
4. Lit by what? Only sources that could be in that room: the practicals in the scene plus one or two lamps you can
   name (a clip lamp with a blue gel; a torch lying behind the hills). No sky gradient, no bloom.
5. Where does it show? List the marks of making that will be in frame: tape, thread, pencil guide lines, the edge
   of the backdrop, a strut behind a standing card, offcuts, the tools themselves.
The palette is not chosen; it follows from the papers, the surface and the lamp gels.

## 2. Techniques and the library function for each
Seeds: every helper in `craft` takes a seed and returns the same numbers on every build.
- Hand-cut edges: `craft.hand_cut(poly, seed, wobble, step, wave)` on every outline a blade cut (0.4-0.8 mm wobble
  on a 13 cm arch reads; 0.2 mm on a 1 cm tile). Scissors make straight snips: build small shapes from a few
  jittered points instead (the fir trees).
- Card has thickness and a core: `mesh.card(name, poly, thickness, face_material, edge_material)`; stand it up with
  `rotation_euler = (pi / 2 - lean, 0, 0)` and give each standing card its own small lean.
- Paper that is never flat: `paper.paper_material(name, color, fibre=, mottle=, vary=, translucency=, transmit=)`.
  `vary` shifts each object, so copies differ. For a light inside a paper shell use `translucency` about 0.2-0.3
  (the shell glows) and `transmit` (shadow rays pass, tinted), so the lamp inside also lights the table.
- Pencil, pen, thread: `craft.stroke_strip(points, width, seed, wobble)` laid 0.03 mm above the card. Leave guide
  lines in: a centre line, the line the arch springs from, a compass circle on the floor piece.
- Tape: `craft.torn_rect(length, width, seed)` extruded 0.13 mm, over every joint a person would have taped,
  never square to anything.
- Each character its own construction: slit-and-rolled sheet, folded box, concertina, card frame with tissue.
  Different paper, different joinery, and the weight follows from the material.
- Desk things at true size at the frame edges, out of focus: pencil, knife, tape roll, offcuts of the very papers
  the characters are made of. A printed 1 cm grid gives scale better than anything else.
- Show where the set ends: the top edge of the backdrop sheet with its tape, the backing board, the dark room.
- Stop motion: set the scene to the pose rate (12 fps, one scene frame per exposure) and bake every channel with
  `interpolation="CONSTANT"`. Sample your continuous choreography at each pose time. `craft.held(values, 2)` holds
  on twos when a scene must stay at 24 fps.
- The hand between exposures: `craft.pose_jitter(seed, n, pos, rot, moved)`; pass `moved` (did the pose change?)
  so an untouched puppet stays dead still. About 0.15 mm and 0.6 degrees at this scale.
- Replacement animation: swap parts on one pose (pencil-line shut eye for a punched dot; a road row appears
  crooked, is straightened on the next exposure, and one or two stay crooked).
- A thing that makes itself (a sheet folding into a boat): four or five replacement shapes of two poses each, every one
  able to stand (tent, paper hat, square on its point, half-opened boat), each put down a millimetre off and turned a few
  degrees. Fold lines pencilled on the flat sheet say what is coming.
- A thing handed to a puppet (hat, pencil): fly a free copy for three poses (lift, turn over, above the head), then switch
  it off and switch on the same part built into the puppet's rig on the landing pose, with a squash. Later shots get it free.
- A thing that raises itself (an arch cut flat, then standing): build it standing, then key the card's own rotation from
  flat (0.07 rad, never 0: it rests on an offcut) through four poses, past upright on the fifth, back on the sixth, and
  only then switch on what a hand adds afterwards (strut, tape at the feet, the lamps on their threads, swinging hard).
  Lay it where the camera sees its face while it is down.
- Tracing paper with a light behind it: a sheet that is never flat (1 mm of wave, a knife-cut top edge), taped to kraft
  posts on the near side, small tabs (11 x 7 mm: at 17 x 10 they read as signboards). Material in blender.md section 4.
  The glow says how far the light is: far back it is wide and dim, near the paper small, bright and sharp.
- A door in a paper screen: a flap cut on the top and one side, hinged on the other, opened over six poses to a little past
  square and back. What comes out is swapped in behind the flap on the pose it starts to move; what stays behind stands
  65 mm deeper, hidden by the first until it leaves, then comes forward to the shut paper. Keep everything that lies on the
  ground (ribbons) out of the flap's quarter circle until it is shut.
- Dawn: a window off frame along the direction of travel (1.2 x 0.8 m area light), turned up between exposures in equal
  stops with uneven steps (`craft.hand_slide`) while its colour goes from cool to rose, and the dark room behind the set
  lifted with it (world strength x 2.4, a little warmer). The window alone only made the desk warmer; the room going from
  navy to grey-violet is what reads as morning. Stop where a lit paper lamp no longer reads brighter than lit kraft.
- A length that must be read: stand the strip on its edge in a slow wave beside a ruler that leans back behind it, its
  ticks along the lower edge, no numerals. The unused part is a roll standing on its end at the free end.
- Light flicker: `craft.flicker(seed, n, amp)` on each light's energy (2-3% lamp, 5% LEDs).
- Camera: locked off, or `camera.slider(obj, frames, start, end, craft.hand_slide(...), jitter)` for a hand-pushed
  move with uneven steps. Bake the focus empty per pose. `camera.lens_character(cam, blades=7)` shapes the bokeh.
- Things that get knocked: `craft.shifts(seed, n, at, amp)`, or key a consequence by hand (the heavy one lands, a
  paper tree falls over, the hill card rocks, the pencil rolls 2 mm).
- The photograph: Cycles (`cycles_preview`, `cycles_final`), real aperture at true scale, then
  `photo.develop(...)` through `render_still(develop=...)` / `render_background(develop=...)`: vignette 0.12,
  fringe 0, grain 0.010 with `fine=True` (per-pixel), flicker 0.012, seeded by the frame number so grain changes per
  exposure. Read section 5
  before choosing f-stop and focus.
- Labels: a handwriting or typewriter face on a dark card-coloured tag; track empties on the root, not on the
  jittered body.
- Words written by the maker (a title tag, a note): an image texture, not a text object. Set a handwriting face letter by
  letter with Pillow (seeded size +-4 %, slant, turn, baseline, spacing, a baseline that rises and sags), soften the edge and let
  noise eat into it, vary the density, keep the ground transparent, and mix it into the card's own paper material by its
  alpha, so fibre and light stay the paper's. Size it from the frame: an x-height of 4 % of the frame height still reads at
  720p (worked example: `claude-timeline`, `tools/make_tag_title.py`, `ct_seq_0.tag_material`).

## 3. The AI-tell check (answer on a preview, fix what fails, before the final render)
1. Is any surface a flat or perfectly smooth default material?
2. Are any two repeated things identical?
3. Is any edge mathematically perfect where a hand would have cut it? (Printed grids and bought objects may be.)
4. Is the light a sky gradient and bloom rather than a real source with a position?
5. Does the motion glide between poses? Does the camera glide?
6. Could this set belong to any other film? (Put in the detail only this subject has.)
7. Is there at least one thing in frame that shows how it was built?
8. Can you see every face at the beat that is about faces? (Puppets cheat toward the lens.)
9. Do the bright things still have their colour, or have they gone white?

## 4. What did not work (example shot)
- Cone trees from two folded triangles read as low-poly CG at once. A snipped fir outline with a fold reads as paper.
- Lanterns at translucency 0.4-0.5 went white and lost their hues, twice. Keep translucency low and LED power
  tiny (0.014-0.09 W inside 3-7 cm shells); raise the light on the table with `transmit`, not with power.
- A 6 W key lamp made a bright teal product shot. Dusk needed 2.6 W and exposure 0.8.
- Characters facing along the road showed one eye or none. Add a yaw offset toward the camera for every beat.
- A ribbon simulated without wind hung straight through the body. A steady push away from the facing
  direction (a "wire in the paper") via the `wind` argument keeps it clear.
- Pencil lids 0.4 mm wide vanished; 0.75 mm reads at 1080p.
- `Path.heading` averaged over 16 cm at desk scale: pass `eps` (see blender.md).
- Perfect ellipses and hexagons still look machined after `hand_cut`; break the base shape first (lobed oval,
  per-vertex jitter of 0.25 mm on the card frame).
- A flat sheet of paper seen from a camera 7 cm above the mat is a sliver 7 mm high. Give it a slight curl so its
  ends lift, keep it clear of anything standing in front, and let the next replacement shape stand up.
- Pencil guide lines drawn in graphite on the dark walnut desk did not show; the maker uses a pale pencil there, and the
  rubbed-out line is a wider, fainter smear with pink rubber crumbs. A key that sinks 2 mm does not show at 0.5 m; 3 mm
  of a 5.4 mm cap does, just.
- Still open: paper fibre is too fine to see at 1080p; glue marks, fingerprints and bent corners are missing; the
  glowing shells are evenly lit where real paper shows hot spots and seams.

## 5. Hand-made is not degraded
The marks of making are in the object (cut edges, tape, thread, flicker), not in a blurred, noisy picture. The first
desk render had a 40 mm lens at f/5.6 on a set a few centimetres tall, with the focus following one puppet: the arch,
the main subject at the start, was out of focus and the lamps were blobs; with grain 0.024 in 1-2 px clumps and a
0.0009 colour fringe on top, the owner said it "looks distorted". Rules, with the numbers that fixed it:
- Whatever the viewer should look at is sharp in every exposure. The far hills, the sky and desk objects at the frame
  edges may be soft. Pose-by-pose focus pulls are optional; small ones only.
- Placing focus on a small set: stop down to f/11-f/16 (f/16 here), take the camera-to-subject depths along the lens
  axis (`tracks.sample_points(...)["depth"]`, not straight-line distance) of everything that matters at each pose,
  and focus at the harmonic mean of the nearest and farthest, `2 * near * far / (near + far)`. Near and far limits
  of the field then sit at equal blur. Check it: with c = 1.5 pixels of a 36 mm sensor across 1920 (0.028 mm),
  H = f^2 / (N c) + f = 40^2 / (16 * 0.028) + 40 = 3.6 m and the limits are s * H / (H +- s). Example here: arch at
  0.494 m and traveller at 0.713 m, focus 0.584 m, limits 0.50 and 0.70 m (the arch is just inside); later the three
  lanterns at 0.41-0.50 m, focus 0.45 m. If near and far do not fit, stop down further or move the camera back
  before accepting softness on a subject.
- Finishing: grain 0.010 (0.024 was heavy), vignette 0.12, exposure flicker 0.012 kept, colour fringe 0 (it
  resamples a channel, so it can only blur). Grain must be no coarser than one pixel: pass `fine=True` to `photo.develop` (the default
  still makes 1-2 px clumps, which the approved plate has). Same raw frame developed both ways at 0.010: edge energy
  after `MedianFilter(5)` is identical (136 whole frame, 533 subject crop), before it 393 fine against 311 clumped
  (finer noise has more edge energy, one more reason to compare after the median); at 100% the clumps show as a
  faint mottle in dark flat areas and the fine grain does not.
- Noise: 64 samples with noise threshold 0.03 (18 s a frame, 108 frames in about 33 min) kept dark areas clean
  enough; 96 samples at 0.02 took 28 s a frame (about 50 min).
- Light: the opening was dark with the arch near silhouette (arch pillars 23-34 of 255 against a frame mean of 45).
  Lifting the existing clip lamp from 2.6 to 3.4 W brought them to 28-42 (mean 52) with nothing near white later
  (no pixel above 254 in poses 50 and 100). Check the darkest pose, not the hero pose.
- Edge-energy check before every full render (variance of PIL `FIND_EDGES` on the greyscale frame, whole frame and
  a crop round the subject), old against new on poses 1, middle and late. Grain adds edge energy, so also measure
  after `MedianFilter(5)`, which removes it and keeps real edges. Here (whole / subject crop after the median):
  pose 1 54 / 64 to 122 / 200, pose 50 109 / 347 to 169 / 406, pose 100 114 / 222 to 206 / 295. If the subject
  crop does not clearly rise, the focus is wrong; fix it before spending 30 minutes on the full render. Then look at
  one old | new crop at 100%.

