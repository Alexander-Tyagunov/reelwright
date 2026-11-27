# Blender backend: 3D plates for Reelwright

Use this when a shot needs real 3D (characters, light, camera moves). Blender renders a *plate*
(frames + `tracks.json`); the engine composites labels over it. Library: `plugin/skills/video/blender/reel_blender/`.
Worked example: `plugin/skills/video/blender/examples/paper_desk/`, a stop-motion paper film at 12 poses a second in Cycles (structure of a film on `film.py`: a look module, a shot
module, a three-shot plan; it is not a house style). A film of many shots on one set registers its look and one builder per
shot with `film.py` (section 12) and keeps one module per sequence.
When a shot must read as made by a person and not as a clean render, read `handmade.md` as well.

## 1. Connection check (first call, always)
Load in one ToolSearch call the tool whose name ends in `execute_blender_code` (its prefix depends on the layout; section 2
explains the layouts), the Blender documentation tools `..._search_api_docs` and `..._get_python_api_docs` if the server has
them, and, in the two-machine layout, the bridge tools `device_list_dir`, `device_stage_files` and `device_commit_files`.
Run `result = {"ver": bpy.app.version_string, "file": bpy.data.filepath}`. If the tool is missing or cannot
connect, stop and tell the user; nothing below works without it. The live Blender still holds whatever the last
session built. `build()` wipes that scene in memory only; a .blend on disk changes only when you save, so give a
new version its own file name (`project.save(new_path)`) and never save over an earlier shot's file.

## 2. Where things run
Name the tool that runs Python in Blender by what it does ("the Blender code tool"): its prefix differs between layouts.
Two layouts work; find out which one you are in at the connection check (section 1) from where `bpy.data.filepath` lives.

**One machine.** Claude Code, the engine and Blender run on the same computer and share files. Write the library, the
film scripts and the plan where Blender can import them; no copying. The shell that renders the film (`reel`) reads the
plates straight from `<project>/plates/`. Free disk space is the disk you work on (section 15).

**Workspace plus a bridged Blender machine.** The session's workspace (shell, files, the engine) is in the cloud and
Blender runs on the user's computer behind a bridge; the two share no disk.
- Workspace: your shell and file tools. Source of truth for the library: `plugin/skills/video/blender/reel_blender/`;
  for a film: `<work>/films/<film>/blender/` (scripts) and `plan/`.
- Blender machine: Blender and a shared folder (here `~/ClaudeProjects`). Library copy
  `~/ClaudeProjects/reelwright/plugin/skills/video/blender/reel_blender/`; film project
  `~/ClaudeProjects/reelwright-work/<film>/` with `scripts/`, `plan/`, `renders/preview/`, `renders/check/`, `plates/<shot>/`,
  `blends/`, `render_queue/`.
- Staging (workspace to Blender machine): copy the changed files under `/mnt/user-data/outputs/<anything>/`, check their syntax
  first with `python3 -c "import ast; ast.parse(open(f).read())"` (`py_compile` leaves `__pycache__` in the repository), then
  `device_commit_files` with `force: true`, one entry per file: `stagedPath` in the workspace, `devicePath`
  `~/ClaudeProjects/...` on the Blender machine (an absolute path inside a connected folder; `~` is accepted).
- Commit step (Blender machine to workspace): `device_stage_files` copies chosen files to
  `/mnt/user-data/uploads/ClaudeProjects/<path under ClaudeProjects>`, from where you read them (stills, check frames) or
  zip and unpack plates (section 7). Stage only what you need to look at.
- The shell on the Blender machine (`device_bash`) can list, move and measure but cannot delete until the user allows it.
- Write code in files and sync; send only short snippets through the Blender code tool:
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
- `<mac>` is `/Users/<user>/ClaudeProjects` (ask Blender: `os.path.expanduser("~")`; on one machine it is wherever the library sits).
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
the runner leaves by itself five seconds after the last job. A film keeps the folder in its project (`film.py` uses `<project>/render_queue`, section 12). Give a check job a file of its own
(`save_as_mainfile(filepath=..., copy=True)` to `ct-C1-check.blend`): it may wait behind an hour of other jobs, and the
shot's own file must stay free to be changed, saved and submitted meanwhile. Submit a shot's check the moment its
first strip looks right, not when all shots are done: behind a busy queue the wait is the hour that matters.

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
Tracing paper with something behind it (the first film's `vellum_material`): mix Diffuse and Translucent, then mix in a rough
Refraction lobe (share 0.30, roughness 0.38, IOR 1.4; the blur grows with IOR - 1, so IOR near 1 shows nothing soft).
The translucent share gives the glow of a light behind, the refraction share the blurred outline of what is close behind
(a lit paper globe 3 cm away reads as a moon), and no shadow ray crosses, so the light behind never lights the near side
directly. Put the LED inside a paper shell (never bare: a bare point light seen through rough refraction is a firefly).
Clean at 64 samples; a full-size frame took 44 s live while the queue was rendering. A disc that comes out as a flat
plateau near 215 of 255 is too bright even though nothing clips: halve the LED.

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
- `film` (section 12), `lettering` (13), `stills` (14), `checks` (15) are the film-level modules added in 0.3.0. The last three need Pillow
  and run in the workspace (import them by name: `from reel_blender import checks`); `film` needs Blender.
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
| the same, shots B1-B3 (88-168 objects) | 1920x1080 | 64 | 16.2 (B1: sky and trees), 16.8 (B2: a 0.5 m screen light on a glossy desk), 14.9 (B3) |
| the same, shots C1-C4 (144-203 objects) | 1920x1080 | 64 | 17.6 (C1), 16.7 (C2), 18.4 (C3), 23.6 (C4: tracing paper with a lit globe behind it; three-frame check jobs)  |
| the same, shots D1-D3 (239-244 objects, up to 14 small lights) | 1920x1080 | 64 | 19.9 (D1), 23.9 (D2: the tracing paper across the whole frame, five lanterns and seven lamps lit), 17.9 (D3); the final jobs of C ran at 14-18.5 |
Later in the same day the Metal kernels were cached and a live `cycles_preview` strip was safe as the first render of a
new session (first frame 3.2 s, then 1.8-3.6 s a frame); the background rule stands for a machine not used that day.
While the queue renders on the same GPU a live preview frame takes 4.2-5.6 s (2.3 s idle): a strip of six is about 30 s,
two strips in one call 54-57 s, which is the limit.
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

20. (Film, sequence B) A standing piece between the lens and the road hides the walker: the near leg of an arch stood in
    front of one landing. Project every leg to the walker's depth (x' = cam_x + (x - cam_x) * walker_depth / leg_depth) and
    compare with each landing's x before the first strip; choose the cheat so the leg falls between two landings.
21. (Film, sequence B) The cutting mats are 3 mm thick: everything past a mat's edge stands 3 mm lower (the first film's `ground` and `foot_z`), and a tile row cannot lie across the step. Ask of every new surface where its top is.
22. (Film, sequence B) From a camera 11 cm high, two lines on the desk that both run across the frame look the same even
    when one is straight and one curves: make them differ in screen direction (one toward the lens). A line needs 2.4 mm
    of width to show at all, and graphite on dark wood does not: use a pale pencil.
23. (Film, sequence B) An emissive screen at strength 0.22 rendered near white under exposure 0.8; 0.065 is dim grey-blue.
    Its light on the desk comes from a separate area lamp hidden from the camera. A translucent paper lamp hanging in
    front of that light looks lit before its LED is on: do not rely on it reading as dark.

24. (Film, sequence C) A camera square to the road sees two lanterns at the same road position as one: the nearer hides
    the other whatever their lateral offset. Stagger every stop along the road by at least a lantern's width, and check
    the stops with `sample_points` (screen x) before animating.
25. (Film, sequence C) A lantern that stops 12 mm past its lamp-post stands between the lens and a lamp hung forward of
    the post. Hang the lamp on the side the lantern came from (`post(arm_deg=150, arm=0.018)`), and project the lantern's
    edge to the lamp's depth before the first strip.
26. (Film, sequence C) Hops chained without a pause put the crouch for the next hop on the landing pose of the last:
    Opus (12 thirtieths in the air, 6 of anticipation, one pose every 2.5) was photographed at half its height. Leave at
    least one pose on the ground (10 in the air here), or lower `impact` on chained hops.
27. (Film, sequence C) A ribbon lying flat on the road is 3 pixels high from a camera 12 cm up and 60 cm away, and a 25 mm
    ruler lying beside it 15. Anything that must be read from a low camera stands: the ribbon on its edge
    (`ribbon_strip(twist=)`), the ruler leant back on props behind the road.

28. (Film, sequence D) Where posts crowd and lanterns pass in front of them, a lamp at lantern height is covered by
    somebody on most poses (the widest lantern, 62 mm, hid its own lamp even 12 mm past the post with the arm reaching
    back). Hang such lamps above the crowd: lamp bottom >= lantern top - (camera z - top) x depth gap / distance, so the
    post is lantern top + lamp + thread + about 1 cm (68-90 mm here, `post(height=)`), each its own height.
29. (Film, sequence D) A set piece from an earlier shot seen again from across the set stands as its own camera needed it:
    the first doorway was 6 degrees from edge-on for the last shot's lens, and once turned, 1.5 m away with only its two
    lamps lit, it read as a pair of eyes. Turn the face to this lens and toward the light that has to show it (check the
    cosine to both), and judge it at the size it has in frame.
30. (Film, sequence D) A focus pull at f/16 on a table-top is small: blur circle = f^2 / N x |1 / s1 - 1 / s2| (0.55 m to
    1.53 m at 40 mm: 0.12 mm, 6 pixels of 1920). The foreground goes soft, not away; compose the last frame so it still
    reads with both planes legible. Pull linearly in 1 / distance, in uneven steps (`film.build_camera`, plan field `focus_pull`).

31. (Film, intro shot) An area light with `spread` under 180 degrees keeps its watts inside the beam, so the middle gets far
    brighter: a 5 cm disk at spread 50 degrees lit cream card 0.38 m away to 185 of 255 with 0.075 W, where the film's open
    12 cm lamps take 2 W from 0.65 m. Work out the watts for a narrow lamp anew (about a tenth at 60 degrees) and check the
    paper for clipping (no channel over 245) before judging anything else.
32. (Film, intro shot) A shot that must cut into another without a jump rebuilds the other shot's set, and several helpers
    are seeded with the shot's own name (`scraps`, `rows_ripple`, `tiles_hop`), while a paper's per-object tint follows the
    object's name: under a new id the offcuts lie elsewhere. Build the shared pieces with the other shot's id and names,
    then prove the cut on a check frame against the other plate's first frame (mean brightness, phase correlation of crops
    for the shift, edge energy after the median for focus) before the final render.

33. (Channel identity, stills) Rolled a lying prop with `rotation_euler.x`: the film's pencil and knife lie by `(0, pi / 2, yaw)`, and
    with Y at 90 degrees a turn about X is a turn about Z, so the pencil swung 23 degrees and lay across the subject. On such a
    prop change `yaw` only; for a top-down still, work out where both ends fall in the frame before the first render.
34. (Channel identity, stills) A queued 2560 x 1440 still died with "No space left on device" (the Mac had under 0.5 GB free; the
    worker writes a raw PNG beside the JPEG). The queue said `error: exit 0` while `render_progress.json` stayed at "starting":
    read `render.log`, and check `shutil.disk_usage` before submitting. A still at 256 samples, noise 0.01 took 32-38 s.

35. (Library 0.3.0) The Object Info "Random" that paper uses for per-object variation is hashed from the object name, so
    renaming every object of a set shifts each paper's tint a little. Measured on the intro shot after neutral names: mean
    brightness +0.3 %, edge energy within 1.3 %, no shift. Fix names before the first approved plate, not after.
36. (Library 0.3.0) A vertical frame is not the 16:9 camera turned: with sensor fit Auto the lens angle spans the longer side,
    so 1080 x 1920 sees 56 % of the width a 1920 x 1080 frame sees, and a 108 mm tag that filled the wide frame was cut at
    its right end. Give the shot a camera for the format (`camera.formats`, section 16), and project the subject's
    extremes with `tracks.sample_points` before rendering.
37. (Library 0.3.0) A seed key built from the shot id (`craft.rng(17, "scraps", sh.id)`) changes the offcuts when the shot is
    renamed or built under another id. Pass an explicit key when the same set must come out the same in two shots.

## 11. Labels
A label follows a track point, and the holds gate fails a label that moves faster than 6% of the short side per
second. Characters that hop make the point bob. Put each track empty above the highest point of the character's
motion while its label shows, so the label never meets the character, or give the label `follow: "x"` in the film.
Parent the empty to the part that carries position only (the root), not to a body that squashes or jitters. The default `smooth` of
0.6 s already lets the box glide while the leader stays on the point. Before the final render run
`reel qa film.json --page-only` and read the holds lines for the labels.

## 12. `film.py`: the calls an animator makes, in order
`film.py` names the public calls of the film mechanics, which have no look in them; the work lives in `plan.py` (the plan, no bpy), `film_state.py`, `film_camera.py`, `film_shot.py` and `film_queue.py`, and `import reel_blender.film as F; F.build_shot(...)` works as before. A film registers once per Blender session; every shot is then the same
few calls. All of them end under 60 s; slow renders go to the queue (section 3).
1. `film.register(name, project, plan, look, builders, shot_params=None, extra_shots=None)`. `look` is a `film.Look(materials,
   world, lights, params, develop, final, prefix)`: the film's materials, world and lights, shared shot parameters (lens, fstop,
   exposure, view_look, ...), the `photo.develop` amounts, and the overrides of `cycles_final`. `builders` is `{shot id:
   fn(sh)}`; `extra_shots` holds shots that are not in the plan (an intro), same shape as a plan entry. Register again after
   reloading the film's modules. `project` is the folder of section 2; `film.py` writes `plates/`, `renders/`, `blends/`,
   `render_queue/` under it.
2. `film.build_shot(shot, overrides=None, fmt=None)` rebuilds the live scene from nothing and returns the report: seconds,
   objects, `focus_m`, `tracks_missing`, and the screen `layout` of the track points at six poses. A builder receives a
   `Shot` (`sh.scene`, `sh.env / chars / trk` collections, `sh.mats`, `sh.p`, `sh.FR` poses, `sh.times` seconds, `sh.points`,
   `sh.switch(obj, first, last)`), builds what the camera sees, bakes constant keys from the pose number and fixed seeds, and
   puts every plan track into `sh.points`. Parameters merge as `look.params`, `shot_params[shot]`, `overrides`.
3. `film.strip(poses, name)` is the live preview strip (six poses or fewer) at `renders/preview/<name>.jpg`; `film.layout(poses)`
   gives the track positions without rendering.
4. `film.submit_check(shot, poses, fmt=None)` queues three poses at final settings, with develop, into
   `renders/check/<shot>/f%04d.jpg` from a copy of the scene in its own file. Submit it the moment the first strip looks right.
5. `film.submit(shot, fmt=None, frames=None)` saves `blends/<name>-<shot>.blend` and queues the final render into the shot's plate folder: `plates/<shot>/`, or the shot's `plate` field when the plan has one (plus `@9x16` for a second format), the rule the engine uses. A shot id may hold letters, digits, `-` and `_` only.
6. `film.export_tracks(shot, fmt=None)` writes `plates/<shot>/tracks.json` from the live scene (events: frame = pose - 1).
7. `film.status()` lists every job, when the queue empties and `free_mb`.
`submit`, `submit_check` and `export_tracks` need the live scene to be that shot in that format and say so when it is not.
Kept from seven animators: constant keys, seeded jitter, one saved .blend per queued job, focus at the harmonic mean of the
nearest and farthest depth of the `in_focus` points (smoothed over three poses). The plan is read only through the accessors
of `plan.py`, which `film.py` re-exports (`plan_shots`, `plan_formats`, `plan_fps`, `shot_poses`, `shot_tracks`, `shot_events`, `shot_in_focus`,
`shot_focus_pull`, `shot_camera`), so a renamed plan field costs one line.

## 13. `lettering.py`: text as an image
Pillow and numpy, run in the workspace. `hand_lettering(out_png, font, size_mm, lines, px_per_mm, ink, seed, proof)` sets a
handwriting face letter by letter with seeded size, slant, turn and baseline, on a drifting line, and lets the paper's tooth
eat the strokes; `printed_text(out_png, font, size_mm, lines, px_per_mm, ink, seed, gain_px, proof)` sets kerned type with ink
gain, uneven ink and pinholes. Both write RGBA (ink in RGB, strokes in alpha) covering a whole face and return its size and
measurements (ink box in mm, line ends or row widths). Mix the image into a paper material by its alpha (`examples/paper_desk/
shots.py`, `tag_material`) so fibre and light stay the paper's. Look at the proof at 100 % and check digits and capitals of the
face: a handwriting face drew "1M" as "IM".

## 14. `stills.py`: pictures, not plates
`render_still_at(scene, path, size, ...)` renders the live scene at a size and restores the scene's own size (Blender). The
rest is Pillow, for the files of a channel or a thumbnail: `circle_sheet(src, out)` shows a profile picture as a circle at 88, 48
and 24 px on dark and on white; `banner_crops(src, out_dir)` writes the centre crops a phone (1546 x 423) and a desktop
(2560 x 423) show; `watermark_cut(src, out, size, shape)` cuts a watermark transparent outside one shape. A still at full
size goes through the queue with a job of its own, like a plate frame.

## 15. `checks.py`: measure before and after a full render
Pillow and numpy, run in the workspace on files staged from the Blender machine. `edge_energy(img, box)` is sharpness
after a 5 px median (grain would raise it); `brightness(img, box)` is the mean of a frame or a band (boxes are shares of the
frame); `match(a, b)` gives shift in pixels, brightness ratio and edge ratio of the same pose from two renders;
`compare_sets(pairs, brightness_tol=0.03, edge_tol=0.05, max_shift=1)` gives a verdict for a list of pairs. Use it for the
three-pose check against an approved plate, and after a library change to prove the picture did not move.

**Free disk space.** Check the free space of the Blender machine before queuing and report it in your handover. A queued still
died once with "No space left on device", and 12 poses a second of film at 1080p is about 0.5 MB a frame plus the raw PNG
while a frame renders. `film.disk_free_mb()` and `film.status()` give it; `submit` and `submit_check` refuse below 500 MB
(`min_free_mb=`). On a machine nearly full, render only what the proof needs and stop when it is below the limit.

## 16. A second format (vertical)
The plan carries `formats` (`{"16:9": [1920, 1080], "9:16": [1080, 1920]}`); the first is the main format. Build, check and
submit with `fmt="9:16"`: the scene takes that size and the plate goes to `plates/<shot>@9x16/` (the file is
`blends/<name>-<shot>@9x16.blend`). A vertical cut is a separate framing, not a crop: give the shot a camera for it in the plan,
`"camera": {"lens_mm": 40, "pos": [...], "aim": [...], "formats": {"9:16": {"pos": [...], "aim": [...]}}}`; the entries
under `formats` replace the shot's own. With sensor fit Auto the lens angle spans the longer side, so a vertical frame sees
about half the width: move the camera back or aim at the middle of the subject, and read `layout()` (all extremes of the subject
between 0.05 and 0.95) before the check. Export tracks per format (`export_tracks(shot, fmt="9:16")`); the engine reads
`plates/<shot>@9x16/` with `reel assemble --format 9:16`. Labels and safe areas are a separate decision per format.
