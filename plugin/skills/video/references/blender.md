# Blender backend: 3D plates for Reelwright

Use this when a shot needs real 3D (characters, light, camera moves). Blender renders a *plate*
(frames + `tracks.json`); the engine composites labels over it. Library: `plugin/skills/video/blender/reel_blender/`.
Worked examples: film `claude-timeline`, shot `shot-claude3` (Eevee; scripts `ct_look.py`, `shot_claude3.py`) and
`shot-claude3-desk` (Cycles, stop motion at 12 fps; `ct_desk_look.py`, `shot_claude3_desk.py`). A film of many shots
on one set: `ct_film.py` (shared module built from the plan's `shots.json`: `build_shot(id, overrides)`,
`export_tracks(id)`, `submit(id)`) with one module per sequence (`ct_seq_a.py`).
When a shot must read as made by a person and not as a clean render, read `handmade.md` as well.

## 1. Connection check (first call, always)
Load in one ToolSearch call: `mcp__remote-devices__Blender__execute_blender_code`, `..._search_api_docs`,
`..._get_python_api_docs`, `mcp__remote-devices__device_list_dir`, `device_stage_files`, `device_commit_files`.
Run `result = {"ver": bpy.app.version_string, "file": bpy.data.filepath}`. If the tool is missing or cannot
connect, stop and tell the user; nothing below works without it. The live Blender still holds whatever the last
session built. `build()` wipes that scene in memory only; a .blend on disk changes only when you save, so give a
new version its own file name (`project.save(new_path)`) and never save over an earlier shot's file.

## 2. Two machines
- Cloud: your shell and file tools. Library source of truth: `plugin/skills/video/blender/reel_blender/`.
  Film scripts: `<work>/films/<film>/blender/`.
- Mac: Blender, the shared folder `~/ClaudeProjects`. Library copy:
  `~/ClaudeProjects/reelwright/plugin/skills/video/blender/reel_blender/`. Film project:
  `~/ClaudeProjects/reelwright-work/<film>/` with `scripts/`, `renders/preview/`, `plates/<shot>/`.
- Cloud to Mac: copy changed files under `/mnt/user-data/outputs/...`, then `device_commit_files` (`force: true`),
  one entry per file: `stagedPath` in the cloud, `devicePath` `~/ClaudeProjects/...` on the Mac. Check syntax in the
  cloud first with `python3 -c "import ast; ast.parse(open(f).read())"` (`py_compile` leaves `__pycache__` in the repo).
- Mac to cloud: `device_stage_files` -> `/mnt/user-data/uploads/ClaudeProjects/<path under ClaudeProjects>`.
- Write code in files and sync; send only short snippets through `execute_blender_code`:
```python
import sys, importlib, traceback
for p in ("<mac>/reelwright/plugin/skills/video/blender", "<mac>/reelwright-work/<film>/scripts"):
    if p not in sys.path: sys.path.insert(0, p)
try:
    import reel_blender
    reel_blender = importlib.reload(reel_blender); reel_blender.reload_all()  # reload the package first: reload_all alone misses modules added since the session started
    import look_x; importlib.reload(look_x)                                   # the look module before the shot that imports it
    import shot_x; S = importlib.reload(shot_x)
    result = S.build()
except Exception:
    result = {"error": traceback.format_exc()[-1800:]}                        # an uncaught error comes back without the traceback you need
```
- `execute_blender_code` starts with no names in scope: `import bpy` (and `sys`, `os`) in every call, or the first line of
  the `try` block fails with `NameError` and the shot module is left half reloaded.
- `<mac>` is `/Users/<user>/ClaudeProjects` (ask Blender: `os.path.expanduser("~")`).
- A whole edit-look round is 5 calls: patch + copy (Bash), commit, build + render (Blender), stage, Read.
- Put every number you expect to tune (light powers, exposure, camera, material amounts) in the shot's `P` dict and
  try values with `S.build({...})`: that round is 3 calls (build + strip, stage, Read) and needs no file sync. Write
  the values you keep back into the file before the final render. Have `build()` return the `layout()` numbers too.

## 3. The 60-second rule
An MCP call that runs past about 140 s times out on your side while Blender keeps working. Keep every call
under 60 s. In a live call you may: build the scene, render preview stills or a strip of up to 6, export tracks.
Never render an animation or a slow frame in a live call: use `background.render_background`, which starts a
second Blender (`--background <saved .blend> --python _bg_worker.py`), returns at once and writes
`render_progress.json`. Save the .blend first; the worker reads the file, not the live session.
Poll with `sleep` in the cloud shell (60-300 s) then `background.read_progress` or `device_list_dir`.
`state` becomes `done` only after the last frame is written: wait for it, not for `done == total - 1`.
`render_background(..., frames=[...], sheet=path)` renders chosen frames and tiles them into one image: a preview
strip that cannot time out. Use it for the first Cycles render of a session and for anything slow; write the
documents and the film spec while a long render runs.
More than one long render, or several sessions rendering on the same Mac: use the queue, not `render_background`
(two background Blenders at once share the GPU and both crawl). `renderqueue.submit(queue_dir, name, blend, out_dir,
frames= | frame_start=, frame_end=, preset=, overrides=, develop=)` adds a job and returns at once; one detached
runner per queue folder renders the jobs strictly one at a time in submission order (job numbers are taken with an
exclusive file, so two sessions cannot get the same place), each through the same worker and with the same
`render_progress.json` / `render.log` in its output folder. `renderqueue.status(queue_dir)` lists every job
(queued, rendering, done, error, cancelled; frames done; seconds per frame) and when the queue should be empty
(it prices waiting jobs at the last measured seconds per frame, so add your own figure for slower shots);
`renderqueue.cancel(queue_dir, id)` removes a waiting job. Give every job its own saved .blend (`ct-A1.blend`), and
do not save that file again while its job waits: the worker opens it when the job starts. `resume=True` (default)
skips frames already on disk, so an interrupted job is simply submitted again. The session that submitted may end;
the runner leaves by itself five seconds after the last job. A film keeps the folder in its own module (`ct_film.QUEUE`,
with `submit(shot)`, `submit_check(shot, poses)`, `status()`).

## 4. Cycles
Use Cycles (Metal GPU) when the shot depends on physical light: soft shadows, light through paper, bounce, real
depth of field. Presets `cycles_preview` (960x540, 24 samples, denoised) and `cycles_final` (1920x1080, denoised,
persistent data); `apply_preset` also sets bounces, clamping, an animated noise seed and enables the Metal device.
The first Cycles render on a machine compiles Metal kernels for about 3 minutes, so the first one of a session
goes to the background (`render_background(frames=..., sheet=...)`): with kernels cached its first frame took
17 s. After that, live `render_strip(preset="cycles_preview")` strips of 6 are safe (3.2-3.9 s a frame).
Measure one or two final-quality frames in the background before the final render and set `samples` / `noise`
from that (numbers in section 6). A light inside a closed shell reaches the table only if the shell lets shadow
rays through: `paper.paper_material(transmit=...)`.

## 5. Library (`reel_blender`)
- `craft` (pure math, seeded): `hand_cut` (knife-cut outlines), `stroke_strip` (pencil, thread), `torn_rect` (tape),
  `pose_jitter`, `flicker`, `hand_slide`, `held` (on twos), `shifts`, `rng`. `paper.paper_material(...)` (fibre,
  mottle, per-object variation, translucency, shadow transmission), `paper.plain_material`. `photo.develop(...)`
  (vignette, fringe, grain, flicker on the rendered file; fringe resamples and softens; grain is 1-2 px clumps unless
  `fine=True`, which gives per-pixel grain of the same strength). See `handmade.md` for when to use them.
- `project.clean_scene()` remove everything, purge orphans. `project.setup_scene(scene, fps, width, height,
  frame_start, frame_end, look=, exposure=, dither=)` units, range, AgX. `project.collection(name)`. `project.save(path)`.
- `mesh.revolve / loft / prism / box / torus` return parts `(verts, faces)`; `mesh.transform`, `mesh.merge`;
  `mesh.new_object(name, part, collection, material, smooth=, smooth_angle=, fix_normals=)`;
  `mesh.set_point_attribute(mesh, name, values)` per-vertex float for shaders;
  `mesh.card(name, poly, thickness, collection, face_material, edge_material)` a cut sheet with its own edge material.
- `anim.key(id, path, [(frame, value)], interpolation=)` sparse eased keys; `anim.bake / bake_vec(id, path,
  frames, values, interpolation=)` one key per frame in bulk; `anim.bake_vertices(mesh, frames, positions,
  interpolation=)`. `"CONSTANT"` holds every pose (stop motion).
- `motion` (pure math, no bpy): easing, `interp_keys`, `Path(points, eps=)` (arc-length path: `at`, `heading`, `left`,
  `offset`; `eps` is the chord over which headings are measured: 0.08 m by default, about 1% of the path length on a
  table-top set),
  `Hop` + `HopTrack` (hop cycles with anticipation, stretch, squash, damped settle; weight by parameters),
  `simulate_chain` (deterministic ribbon / rope), `ribbon_strip`, `ribbon_faces`.
- `camera.make_camera`, `make_empty`, `aim_at(cam, target)`, `key_move(obj, [(frame, xyz)])`, `key_lens`, `set_dof`,
  `slider(obj, frames, start, end, progress, jitter)` (stepped hand-pushed move), `lens_character(cam, blades=)`.
- `render.apply_preset(scene, name, **overrides)`, `render_still(scene, path, frame, preset, develop=)`,
  `render_strip(scene, frames, out_path, preset=, cols=, develop=)` several frames tiled into one image,
  `contact_sheet(paths, out)`.
- `background.render_background(blend, out_dir, start, end, preset=, overrides=, resume=, frames=, develop=,
  sheet=)`, `read_progress(path)`.
- `renderqueue.submit / status / cancel / ensure_runner` (section 3): one-at-a-time render queue shared by sessions;
  no bpy needed for `status` and `cancel`.
- `tracks.sample_points(scene, cam, {name: object}, frames)` layout numbers without rendering;
  `tracks.export_tracks(scene, cam, points, out_path, events=[(name, scene_frame)])`.
- `plate.pack_plate(dir)` zip for transfer; `plate.check_plate(dir)` frames vs tracks.
Rules: pure functions, units in docstrings, no project paths, no look. The look lives in the film's own script.
Animation is baked from math and fixed seeds (no handlers, no playback, no live physics), so `build()` gives
the same scene every time. Rebuild from scratch on every change (both examples build in 0.3 s).
Scale: defaults assume a set tens of metres across. For a table-top set built at true size pass `Path(eps=)`,
`make_camera(clip=(0.02, 30))`, small empty sizes, and expect light powers of hundredths of a watt.

## 6. Presets and measured speed (M1 Pro, Metal, Blender 5.3, example shot: 150 objects, 9 lights, DOF, bloom)
| preset | size | Eevee samples | ray tracing | sec / frame |
|---|---|---|---|---|
| preview | 960x540 | 12 | off | 0.3 (first frame of a session 0.6-0.9; a still with scene sync 3.8) |
| draft | 960x540 | 20 | half-res | 0.69 background (270 frames in 194 s; first frame 8.9 s) |
| final | 1920x1080 | 40 | half-res | 2.69 background (270 frames in 727 s, about 12 min; first frame 3.0 s; a live still 3.1-3.9) |
Final ran with `dof_jitter=False` (see mistakes). Budget: draft the whole shot before any final.

Cycles, desk example (160 objects, 2 area lights, 8 point lights, translucent paper, DOF, `photo.develop` included):
| preset | size | samples | sec / frame |
|---|---|---|---|
| cycles_preview | 960x540 | 24, noise 0.1 | 3.2-3.9 live (first frame of a session 17 in the background) |
| cycles_final | 1920x1080 | 96, noise 0.03 | 23.4 background (would be 42 min for 108 frames) |
| cycles_final, `samples=64, noise=0.04` | 1920x1080 | 64 | 18.6 background (108 frames in 2010 s, 33.5 min; first frame 19.5 s) |
| cycles_final, f/16, `samples=64, noise=0.03` (v2) | 1920x1080 | 64 | 18.0 background (108 frames, about 32.5 min); a live-sized check of 3 frames took 21 s each |
| cycles_final, f/16, `samples=96, noise=0.02` | 1920x1080 | 96 | about 28 (too slow for 108 frames in 45 min) |
| cycles_final, `samples=64, noise=0.03`, shots A1-A3 (72-107 objects) | 1920x1080 | 64 | 7.3-9.4 (A1: dark room, no backdrop), 12.0 (A2), 18.6 (A3: both sky boards and the trees) |
Later in the same day the Metal kernels were cached and a live `cycles_preview` strip was safe as the first render of a
new session (first frame 3.2 s, then 1.8-3.6 s a frame); the background rule stands for a machine not used that day.
A shot on twos has half the frames: at 12 poses a second, 9 s is 108 renders, which is what makes Cycles affordable.

## 7. Plate contract (fixed)
`plates/<shot>/frames/0001.jpg ...` (JPEG quality 95) and `tracks.json`:
```json
{ "version": 1, "fps": 30, "frames": 270, "width": 1920, "height": 1080,
  "frame_pattern": "frames/%04d.jpg", "first": 1,
  "points": { "name": { "x": [], "y": [], "visible": [], "depth": [] } },
  "events": [ { "name": "split", "frame": 119 } ] }
```
`x` 0..1 from the left, `y` 0..1 from the top (flipped from Blender's camera view), `visible` 0 when behind the
camera, outside the frame, hidden from render or scaled to zero, `depth` in metres, events in 0-based plate
frames (scene frame minus first scene frame). `fps` is the plate's own rate and may differ from the film's: a
stop-motion plate is 12 fps (set the scene to 12 fps, one scene frame per pose) under a 30 fps film, and the engine
holds each frame. Track empties parented to what they follow (name them `TRK_*`).
Switch a rig off by keying its root scale to 0: children of a `hide_render` parent still render.
Transfer: `plate.pack_plate` on the Mac, `device_stage_files` the zip, unzip in the cloud, then ffmpeg:
`ffmpeg -framerate <plate fps> -i frames/%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 out/<shot>-preview.mp4`.
Labels, vignette and grain belong to the engine, not the plate. The one exception is a look that must read as
photographed (`handmade.md`): there the lens and sensor faults are part of the picture and go into the plate with
`photo.develop`, kept small, and the film adds none of its own. Leave calm, dark areas beside every tracked point.

## 8. What to check on previews
Budget about 14 looks. Before rendering anything, read `tracks.sample_points` numbers for framing.
- Stills (960x540): silhouette of each character against its background; three value groups (dark world, mid
  road, bright characters); nothing important clipped to white; hues still distinct after the view transform;
  depth layers (foreground blur, sharp subject, soft far); edges that look faceted or default.
- One full-size final-quality still before the final render: bokeh noise, shadow aliasing, banding, tiny details
  (eyes, glints), speculars where you wanted dark.
- Strips (`render_strip`, 6 frames): poses across an action: anticipation, the extreme, the landing, the settle;
  secondary motion trailing the right way; nobody hidden behind set pieces.

## 9. Blender 5.x API notes
- `Action.fcurves` is gone. Use `bpy_extras.anim_utils.action_ensure_channelbag_for_slot(action, slot)`; create
  the slot with `action.slots.new(id_type=idb.id_type, name=idb.name)`. `anim.py` wraps this.
- Mesh vertices animate through F-curves on the mesh: `vertices[i].co` (used for ribbons).
- Compositor: `scene.compositing_node_group` (a `CompositorNodeTree` node group with an output socket and a
  `NodeGroupOutput` node). Glare settings are input sockets (`Type` = `"Bloom"`, `Threshold`, `Strength`, `Size`).
- Eevee engine id is `BLENDER_EEVEE`; there is no bloom setting: bloom is the compositor Glare node.
- `image_settings.media_type = "IMAGE"` before `file_format`. `render.dither_intensity` fights sky banding.
- `bl_rna` enum lists are empty for dynamic enums (colour looks, add-on engines): set the value in `try`.
  The Punchy look is `"AgX - Punchy"`.
- `Object.visible_shadow = False` lets a light sit inside a glowing mesh. Object colour (`obj.color`, read by
  an Object Info node) is the simplest animatable per-object shader input: RGB tint, alpha glow.
- When an attribute fails, look it up with `search_api_docs` / `get_python_api_docs`; do not guess twice.

## 10. Mistakes made on the example shot (do not repeat)
1. Lit everything too bright at first: emissive bodies and paper next to 400 W point lights went white and the
   three characters lost their colours. Start emission near 1, lights low, then check hue separation.
2. A lit ribbon passing close to a point light blew out. Self-lit graphic elements get a black base colour plus
   emission so scene lights cannot touch them.
3. Jittered DOF turned small bright stars into noisy discs; the plain DOF filter was clean and faster.
4. A flat-shaded lofted arch showed stair-steps under grazing light. Use `smooth_angle`.
5. Noise bump on "paper" read as bark at close range; glossy closed eyes caught white highlights. Matte first.
6. The first ribbon simulation was so damped it never settled (it stood upright after every stop). Check the
   time constant: terminal speed = acceleration x substep time / drag.
7. Polled a background render one frame early and wasted two calls. Wait for `state == "done"`.
8. Hills were first sized without the camera: with a low camera, compute each layer's height from the elevation
   angle you want it to reach (`camera_z + distance * tan(angle)`) so sky stays in frame.
9. Characters at the end of a road that bends toward camera overlap the set piece they left; plan the last
   frame's screen positions with `sample_points` before animating the middle.
10. Judged exposure on the lit beats only; the unlit opening came out very dark under the Punchy look. Look at
    the darkest frame of the shot at final quality before rendering, not only the hero frame.
11. (Desk shot) Characters faced along their path, so at the beat about eyes one eye or none showed. Puppets cheat
    toward the lens: add a yaw offset per beat and look at that beat in a strip.
12. (Desk shot) Lit too bright again at a new scale: a light 1.5 cm from a paper shell needs hundredths of a watt.
    Calibrate powers on the first preview before judging anything else.
13. (Desk shot) `Path.heading` used a fixed 8 cm chord and averaged the whole curve of a 1 m road; now `Path(eps=)`.
14. (Desk shot) `reload_all()` did not load modules added during the session; reload the package first (section 2).
15. (Desk shot) Shot at f/5.6 with a 40 mm lens on a set 3-13 cm tall, focus following one puppet: the arch and
    lamps were soft, and grain 0.024 plus a 0.0009 fringe sat on top; the owner called it "distorted". At table-top
    scale depth of field is millimetres. Use f/11-f/16 and place focus from `sample_points` depths (see handmade.md
    section 5), and keep the finishing pass light; judge a still at 100%, not scaled down.
16. (Desk shot) Judged sharpness by eye on half-size previews and measured edge energy with grain on: grain raises
    edge energy, so a noisy soft frame can out-score a clean sharp one. Compare after `MedianFilter(5)` as well.

17. (Film, sequence A) An arch that spans a road running across the frame is seen edge-on by a camera at the front of
    the desk (12 degrees off its plane: a 12 cm arch is 2 cm wide on screen) and shows its plain back. Stations take a
    `cheat` angle that turns the face toward the lens (50 degrees for arches, 35 for a doorway 39 mm wide that a 31 mm
    lantern must still pass); check the opening that is left across the road: opening x sin(angle between plane and road).
18. (Film, sequence A) A hop that lands just past an arch crosses its plane near the top of the arc: handle top = body
    height + 4 h u (1 - u) at the crossing. Lower the arriving hop or shorten the lamp's thread before a strip shows the
    handle through the lamp.
19. (Film, sequence A) A strut behind a standing card and pale tape in the foreground are marks of making only when they
    are small in frame: a 5 cm strip of tape lying 20 cm from the lens was the brightest thing in the picture. Put
    them where the frame shows them small, or behind a leg.

## 11. Labels
A label follows a track point, and the holds gate fails a label that moves faster than 6% of the short side per
second. Characters that hop make the point bob. Put each track empty above the highest point of the character's
motion while its label shows, so the label never meets the character, or give the label `follow: "x"` in the film.
Parent the empty to the part that carries position only (the root), not to a body that squashes or jitters. The default `smooth` of
0.6 s already lets the box glide while the leader stays on the point. Before the final render run
`reel qa film.json --page-only` and read the holds lines for the labels.
