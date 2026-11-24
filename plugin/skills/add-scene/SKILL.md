---
name: add-scene
description: Add a new scene type to Reelwright - a custom layout, chart, diagram or animation that the built-in scenes do not cover, for one project or for the plugin itself. Use when the user asks to add, create or extend a scene, template, layout or animation type for Reelwright, or when a film needs a visual no built-in scene provides.
---

# Add a scene type

Read `${CLAUDE_SKILL_DIR}/../video/references/scene-api.md` first; it is the contract. Then read one built-in scene close
to what you need in `${CLAUDE_SKILL_DIR}/../video/scripts/runtime/scenes/` and follow its shape. CLI:
`node ${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts <command>` (written `reel` below).
If that folder is not next to this one, load this plugin's `video` skill and use the CLI path it gives.

1. Check that no built-in scene already does it: `reel scenes`. A new option on an existing scene is better than a
   near-duplicate scene.
2. Decide the spec fields before the code: what an author writes in `film.json`. Keep them few and named for
   content (`steps`, `value`), not for styling.
3. Write the scene file.
   - For one project: `<project>/scenes/<type>.js` or `.ts`, listed in the spec as
     `"customScenes": ["scenes/<type>.js"]`. It calls `Reel.scene(type, (ctx, s) => {...})`. A `.ts` file is
     type-stripped by the server, so it uses erasable syntax only.
   - For everyone using the plugin: one `.ts` file, `runtime/scenes/<type>.ts`, in the plugin source. It holds, in
     this order: a header block comment, a `@fileoverview`, an exported spec interface that extends `SceneSpec`
     (for example `TitleSceneSpec`, with `type: '<type>'` and a TSDoc line per field), and a
     `registerScene('<type>', (ctx, scene) => {...})` call. Add `import './<type>.ts';` to
     `runtime/scenes/index.ts` so the scene registers.
   The header block is the first comment in the file. Its first line reads `<type> — <summary>` and the lines
   after it list the spec fields, one per line. `reel scenes` reads it, so write it as the field list an author
   needs. After adding a built-in scene, regenerate `${CLAUDE_SKILL_DIR}/../video/references/scenes.md` with `reel scenes --md`.
4. Every frame must be a pure function of `t`: no clocks, no `Math.random()`, no CSS transitions, no state kept
   between frames. Register all copy with `ctx.text` so the gates can measure it. Size in `u`, colour from the
   CSS variables.
5. Make a test film that uses the scene with short content and with the longest realistic content. Draw stills at
   three sizes and look at each contact sheet:
   `reel stills film.json`, `--size 1080x1080`, `--size 1080x1920`.
6. Look at the motion, not only the settled frame: `reel stills film.json --from A --to B --every 0.15`, then open `out/strip.jpg`.
7. `reel render film.json` and `reel qa film.json` must pass, including determinism.

Hand a project scene to `reel-builder` (Sonnet) with the description of the scene and the spec fields you decided;
it does not edit the plugin folder, so a built-in scene is done in this session. Use
`reel-auteur` (Fable) only when the scene is 3D, simulates physics, or needs illustration-level drawing.
