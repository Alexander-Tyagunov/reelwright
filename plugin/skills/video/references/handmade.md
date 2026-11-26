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
- Light flicker: `craft.flicker(seed, n, amp)` on each light's energy (2-3% lamp, 5% LEDs).
- Camera: locked off, or `camera.slider(obj, frames, start, end, craft.hand_slide(...), jitter)` for a hand-pushed
  move with uneven steps. Bake the focus empty per pose. `camera.lens_character(cam, blades=7)` shapes the bokeh.
- Things that get knocked: `craft.shifts(seed, n, at, amp)`, or key a consequence by hand (the heavy one lands, a
  paper tree falls over, the hill card rocks, the pencil rolls 2 mm).
- The photograph: Cycles (`cycles_preview`, `cycles_final`), real aperture at true scale, then
  `photo.develop(...)` through `render_still(develop=...)` / `render_background(develop=...)`: vignette 0.22,
  fringe 0.0009, grain 0.024, flicker 0.012, seeded by the frame number so grain changes per exposure.
- Labels: a handwriting or typewriter face on a dark card-coloured tag; track empties on the root, not on the
  jittered body.

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
- Still open: paper fibre is too fine to see at 1080p; glue marks, fingerprints and bent corners are missing; the
  glowing shells are evenly lit where real paper shows hot spots and seams.
