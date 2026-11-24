# When another engine is the better tool

Reelwright's own runtime covers text, data, diagrams, code and screenshots: the films this plugin is for.
Some jobs belong elsewhere. Facts below were checked against each project's repository in November 2026;
licences change, so check again before a commercial decision.

| Need | Use | What it costs you |
|---|---|---|
| Release notes, metrics, explainers, social clips | **Reelwright runtime** (this plugin) | Nothing to install beyond Node 24, ffmpeg and a browser. MIT. |
| A video system inside a React codebase: your own components, props-driven batch renders, a player embedded in a product, cloud rendering | **Remotion** (`remotion-dev/remotion`, v4) with its official skills | A React and bundler toolchain. Free for individuals, non-profits and for-profit companies of up to 3 employees; larger companies need a paid company licence. Not OSI open source. |
| HTML and GSAP timelines with a large block catalogue, TTS, captions, website capture | **HyperFrames** (`heygen-com/hyperframes`, Apache-2.0, pre-1.0) | Usage telemetry is on by default (`HYPERFRAMES_NO_TELEMETRY=1` turns it off); its skill reports usage to HeyGen; media generation leads to paid HeyGen credits. |
| Mathematics: equations transforming, graphs, geometry | **Manim** (`ManimCommunity/manim`, MIT) | Python, LaTeX and Cairo to install; its own scene model. Render it to MP4 and cut it in as a clip. |
| Real 3D: product shots, lit materials, characters | **Blender** by script (`blender -b -P scene.py`) or a Blender MCP; **three.js** for 3D inside a custom scene | Long renders. The community Blender MCP collects anonymous usage data by default (`DISABLE_TELEMETRY=true`). This is `reel-auteur` work. |
| Timeline-heavy kinetic type inside a custom scene | **GSAP** (free under Webflow's standard licence, not an OSI licence) | Vendor it into the project and drive one paused timeline from `t` (`tl.time(t)`); never let it run on its own clock. |
| Letting the agent look at an existing video | `ffmpeg` frame extraction (what `reel stills` does for its own films), or a `/watch`-style plugin for web videos | Frames and a transcript are not watching: rhythm and sound still need a person. |
| Real footage, faces, photoreal scenes | A video-generation model or a camera | Outside what code-drawn video does. |

## What every one of these has in common

Each serious tool reaches the same contract by a different route: Remotion's `useCurrentFrame()`, HyperFrames'
paused timelines with no clocks and no unseeded randomness, Manim's scene graph, and this plugin's
`renderAt(t)`. A frame is a pure function of time, rendered one at a time in a headless renderer and encoded by
ffmpeg. If you adopt another engine, keep that property and keep measuring the output: `reel qa` gates that work on
the MP4 alone (file properties, motion, freezes, loudness) apply to a video from any engine via `--video`.

## Not video tools

Often listed alongside the above, but they solve other problems: Excalidraw and Rough.js (sketch-style
diagrams; usable as a look inside a custom scene), Magic UI (React components for websites), and the UI-taste
skills (`ui-ux-pro-max-skill`, `taste-skill`, `impeccable`), which carry web-interface rules such as touch
targets, responsive breakpoints and page sections. Loading them into a video session spends context on rules
that do not apply.
