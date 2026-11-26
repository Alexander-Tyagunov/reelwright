# Blender backend: 3D plates for Reelwright

Use this when a shot needs real 3D (characters, light, camera moves). Blender renders a *plate*
(frames + `tracks.json`); the engine composites labels over it. Library: `plugin/skills/video/blender/reel_blender/`.
Worked example: film `claude-timeline`, shot `shot-claude3` (scripts `ct_look.py`, `shot_claude3.py`).

## 1. Connection check (first call, always)
Load in one ToolSearch call: `mcp__remote-devices__Blender__execute_blender_code`, `..._search_api_docs`,
`..._get_python_api_docs`, `mcp__remote-devices__device_list_dir`, `device_stage_files`, `device_commit_files`.
Run `result = {"ver": bpy.app.version_string, "file": bpy.data.filepath}`. If the tool is missing or cannot
connect, stop and tell the user; nothing below works without it.

## 2. Two machines
- Cloud: your shell and file tools. Library source of truth: `plugin/skills/video/blender/reel_blender/`.
  Film scripts: `<work>/films/<film>/blender/`.
- Mac: Blender, the shared folder `~/ClaudeProjects`. Library copy:
  `~/ClaudeProjects/reelwright/plugin/skills/video/blender/reel_blender/`. Film project:
  `~/ClaudeProjects/reelwright-work/<film>/` with `scripts/`, `renders/preview/`, `plates/<shot>/`.
- Cloud to Mac: copy changed files under `/mnt/user-data/outputs/...`, then `device_commit_files` (`force: true`).
- Mac to cloud: `device_stage_files` -> `/mnt/user-data/uploads/ClaudeProjects/<path under ClaudeProjects>`.
- Write code in files and sync; send only short snippets through `execute_blender_code`:
```python
import sys, importlib
for p in ("<mac>/reelwright/plugin/skills/video/blender", "<mac>/reelwright-work/<film>/scripts"):
    if p not in sys.path: sys.path.insert(0, p)
import reel_blender; reel_blender.reload_all()
import shot_x; S = importlib.reload(shot_x)
result = S.build()
```
- A whole edit-look round is 5 calls: patch + copy (Bash), commit, build + render (Blender), stage, Read.

## 3. The 60-second rule
An MCP call that runs past about 140 s times out on your side while Blender keeps working. Keep every call
under 60 s. In a live call you may: build the scene, render preview stills or a strip of up to 6, export tracks.
Never render an animation or a slow frame in a live call: use `background.render_background`, which starts a
second Blender (`--background <saved .blend> --python _bg_worker.py`), returns at once and writes
`render_progress.json`. Save the .blend first; the worker reads the file, not the live session.
Poll with `sleep` in the cloud shell (60-300 s) then `background.read_progress` or `device_list_dir`.
`state` becomes `done` only after the last frame is written: wait for it, not for `done == total - 1`.

## 4. Cycles
The first Cycles render compiles Metal kernels for about 3 minutes; later ones start at once. Warm it with a
tiny background render, never in a live call. Reference: 960x540, 32 samples, default scene: about 1.7 s.
`cycles_still` preset exists but was not exercised on the example shot (Eevee carried it).

## 5. Library (`reel_blender`)
- `project.clean_scene()` remove everything, purge orphans. `project.setup_scene(scene, fps, width, height,
  frame_start, frame_end, look=, exposure=, dither=)` units, range, AgX. `project.collection(name)`. `project.save(path)`.
- `mesh.revolve / loft / prism / box / torus` return parts `(verts, faces)`; `mesh.transform`, `mesh.merge`;
  `mesh.new_object(name, part, collection, material, smooth=, smooth_angle=, fix_normals=)`;
  `mesh.set_point_attribute(mesh, name, values)` per-vertex float for shaders.
- `anim.key(id, path, [(frame, value)], interpolation=)` sparse eased keys; `anim.bake / bake_vec(id, path,
  frames, values)` one key per frame in bulk; `anim.bake_vertices(mesh, frames, positions)`.
- `motion` (pure math, no bpy): easing, `interp_keys`, `Path` (arc-length path: `at`, `heading`, `left`, `offset`),
  `Hop` + `HopTrack` (hop cycles with anticipation, stretch, squash, damped settle; weight by parameters),
  `simulate_chain` (deterministic ribbon / rope), `ribbon_strip`, `ribbon_faces`.
- `camera.make_camera`, `make_empty`, `aim_at(cam, target)`, `key_move(obj, [(frame, xyz)])`, `key_lens`, `set_dof`.
- `render.apply_preset(scene, name, **overrides)`, `render_still(scene, path, frame, preset)`,
  `render_strip(scene, frames, out_path, cols=)` several frames tiled into one image, `contact_sheet(paths, out)`.
- `background.render_background(blend, out_dir, start, end, preset=, overrides=, resume=)`, `read_progress(path)`.
- `tracks.sample_points(scene, cam, {name: object}, frames)` layout numbers without rendering;
  `tracks.export_tracks(scene, cam, points, out_path, events=[(name, scene_frame)])`.
- `plate.pack_plate(dir)` zip for transfer; `plate.check_plate(dir)` frames vs tracks.
Rules: pure functions, units in docstrings, no project paths, no look. The look lives in the film's own script.
Animation is baked from math and fixed seeds (no handlers, no playback, no live physics), so `build()` gives
the same scene every time. Rebuild from scratch on every change (the example builds in 0.3 s).

## 6. Presets and measured speed (M1 Pro, Metal, Blender 5.3, example shot: 150 objects, 9 lights, DOF, bloom)
| preset | size | Eevee samples | ray tracing | sec / frame |
|---|---|---|---|---|
| preview | 960x540 | 12 | off | 0.3 (first frame of a session 0.6-0.9; a still with scene sync 3.8) |
| draft | 960x540 | 20 | half-res | 0.69 background (270 frames in 194 s; first frame 8.9 s) |
| final | 1920x1080 | 40 | half-res | 2.69 background (270 frames in 727 s, about 12 min; first frame 3.0 s; a live still 3.1-3.9) |
Final ran with `dof_jitter=False` (see mistakes). Budget: draft the whole shot before any final.

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
frames (scene frame minus first scene frame). Track empties parented to what they follow (name them `TRK_*`).
Switch a rig off by keying its root scale to 0: children of a `hide_render` parent still render.
Transfer: `plate.pack_plate` on the Mac, `device_stage_files` the zip, unzip in the cloud, then ffmpeg:
`ffmpeg -framerate 30 -i frames/%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 out/<shot>-preview.mp4`.
Labels, vignette and grain belong to the engine, not the plate. Leave calm, dark areas beside every tracked point.

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
