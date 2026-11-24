---
name: release
description: Prepare a Reelwright release - run every check, bump the version, update the changelog and confirm the plugin still validates. Use when asked to cut, prepare or publish a release of this repository.
---

# Release checklist

Work through these in order. Stop at the first failure and fix it before going on.

1. `npm run check` passes: typecheck, lint, unit tests.
2. `npm run test:e2e` passes. It needs Chrome and ffmpeg and takes several minutes.
3. `node plugin/skills/video/scripts/reel.ts doctor` reports everything present.
4. `claude plugin validate ./plugin` passes with nothing to report.
5. The plugin folder holds no `out/` folders, no `.DS_Store`, no `node_modules`, no lockfile, no `bin/`.
6. `plugin/skills/video/references/scenes.md` matches `reel scenes`. Regenerate it if a scene changed.
7. Every user-visible change is described in the skill or reference that covers it and in `CHANGELOG.md`.
8. Raise `version` in `plugin/.claude-plugin/plugin.json` and in the root `package.json` to the same value.
9. Render the `release` template, run `reel qa` on it and open the contact sheet. Press play on the MP4.
10. Commit, tag `v<version>`, push. The directory picks up the tracked branch.

Report the result of each step with its output, not a summary.
