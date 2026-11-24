---
paths:
  - "plugin/skills/video/scripts/runtime/**"
---

# Browser runtime

- This code runs in the page. No Node APIs. The DOM lib is available; `tsconfig.runtime.json` checks it.
- A frame is a pure function of time. No `Date.now`, `performance.now`, timers, `requestAnimationFrame` outside
  the live player, `Math.random`, CSS transitions or animations, or state kept between frames.
- Randomness comes from the scene context's seeded generator.
- Do not scale an `<img>` or `<canvas>` with a transform. Paint images as CSS backgrounds when they must zoom.
- Register all copy with `ctx.text` so the gates can measure it. Report per-frame reveals with `ctx.settle`.
- Size in `u`. Colour from the brand variables only. Classes use the `rw-` prefix.
- `timeline.ts`, `transitions.ts` and `holds.ts` stay free of DOM access so the unit tests can import them.
- After a change, run the determinism scenario in `tests/e2e` and look at stills at 16:9, 1:1 and 9:16.
