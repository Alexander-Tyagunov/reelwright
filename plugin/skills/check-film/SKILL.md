---
name: check-film
description: Check and fix an existing Reelwright film - run the measured quality gates, read the stills, and repair what fails. Use when the user asks to check, QA, review, verify or fix a video made with Reelwright, reports that a film looks frozen, cut off, overlapping, too fast or unreadable, or before publishing a film.
---

# Check a film

A model that looks at stills will pass a frozen film. So measure first, look second, and report numbers.
CLI: `node ${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts <command>` (written `reel` below).
If that folder is not next to this one, load this plugin's `video` skill and use the CLI path it gives.

1. `reel stills film.json` and open `out/contact.jpg`. For a film with several formats repeat with `--size`.
2. `reel qa film.json --page-only` is a quick check of the page gates without a render. For the full check,
   `reel render film.json` if there is no current render, then `reel qa film.json`; a missing render gives the
   verdict INCOMPLETE.
3. Read the table. `${CLAUDE_SKILL_DIR}/../video/references/qa-gates.md` explains each gate, its threshold and the usual fix.
4. Fix one failure at a time with the smallest edit that addresses the measured problem, keeping everything else
   as it was. Re-render (only changed scenes are redrawn) and re-run `reel qa`.
5. For a motion problem that a still cannot show, draw a strip of the moment:
   `reel stills film.json --from 4.0 --to 5.2 --every 0.1` (written to `out/strip/` and `out/strip.jpg`).
6. Stop when every gate passes, or after 3 rounds on the same failure; then report what still fails and why.

Report: the final gate table, what you changed, and what remains for a person to judge by pressing play: rhythm,
whether the emphasis lands, and sound. Those are the things neither the gates nor stills can tell you.

Common findings and their fixes:

| Finding | Fix |
|---|---|
| Hold too short | Lengthen the scene's `duration`, or cut words. Do not speed up the entrance. |
| Text outside safe area or clipped | Shorten the copy first; then reduce items; a scene type with more room last. |
| Overlap | Two blocks compete for one place: remove one or split the scene. |
| Low contrast | Use `--ink` or `--muted` on `--bg` or `--surface`; do not put body text in the accent colour. |
| Freeze longer than the limit | The scene outlives its content: shorten it, or raise `meta.maxHold` only if the hold is intended. |
| Scene shows no motion | The scene's animation is not wired to time, or the scene is empty; check the spec fields against `reel scenes`. |
| Determinism failure | A custom scene uses a clock, `Math.random()` or state kept between frames; make it a pure function of `t`. |
| Blank first frame | Export with `--poster auto` so the thumbnail is a settled frame. |
