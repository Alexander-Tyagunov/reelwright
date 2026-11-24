# Reelwright

A Claude plugin that turns a JSON film spec into an MP4: release videos, explainers, animated metrics. The
installable plugin is `plugin/`. Everything else in this repository is the development workspace.

## Commands

```bash
npm run check        # typecheck + lint + unit tests. Run before you call any change finished.
npm run typecheck    # tsc for the Node side and for the browser runtime
npm run lint         # biome check .     (npm run fix applies formatting)
npm test             # unit tests, no browser
npm run test:e2e     # whole-pipeline scenarios; need Chrome and ffmpeg; slow
claude plugin validate ./plugin
node plugin/skills/video/scripts/reel.ts doctor
```

Node 24 or newer. TypeScript runs directly; there is no build step and no compiled output.

## Where things are

| Path | What |
|---|---|
| `plugin/skills/*/SKILL.md` | The six skills. `video` is the pipeline; the others are recipes on top of it. |
| `plugin/agents/reel-*.md` | Six agents, each pinned to a model tier. |
| `plugin/skills/video/scripts/` | The engine. `reel.ts` is the CLI entry. |
| `plugin/skills/video/scripts/runtime/` | Browser code. DOM only, no Node APIs. |
| `plugin/skills/video/scripts/shared/contract.ts` | Types that cross the Node/browser boundary. |
| `plugin/skills/video/references/` | Docs the skills and agents read at run time. |
| `tests/unit`, `tests/e2e` | Business rules; whole-pipeline scenarios. |
| `docs/ARCHITECTURE.md` | Layout, hard rules, contracts. Read it before a structural change. |
| `docs/KNOWN-ISSUES.md` | Problems already met and how each was solved. Check it before debugging. |

## Rules that are easy to break

- **No runtime dependencies in `plugin/`.** No `package-lock.json` there, no `node_modules`, no `bin/` folder.
- **Erasable TypeScript only.** No `enum`, `namespace`, parameter properties or decorators. Imports carry the
  `.ts` extension. Types are imported with `import type`.
- **A frame is a pure function of time.** In runtime code: no clocks, no `Math.random`, no CSS transitions, no
  state kept between frames. Use the seeded generator from the scene context.
- **Do not scale an `<img>` or `<canvas>` with a transform.** Paint the image as a CSS background instead.
- **Subprocesses get argument arrays.** Nothing is passed through a shell.
- **Skill frontmatter is `name` and `description` only.** Other fields stop the plugin loading outside Claude Code.
- **Skills reach the engine through `${CLAUDE_SKILL_DIR}`**, agents through `${CLAUDE_PLUGIN_ROOT}`.

## Style

- ts.dev conventions, enforced by Biome: 2 spaces, single quotes, semicolons, 80 columns, named exports.
- Files under 200 lines where possible, never over 300. One responsibility per file.
- TSDoc on every export and a `@fileoverview` in every file. Write it for someone hovering in an IDE.
- Comments inside functions are rare and are one line of plain, active English. No code in comments.
- Do not name an outside article, post, person or product as the source of an idea in code.
- A message a user can trigger says what went wrong and what to do next.

## Tests

A test exists because a real scenario or a known edge case needs it, and its name states that scenario. Do not
add a test to raise coverage. When a gate changes, the seeded-defect scenario for it changes in the same commit.

## When you add something

- **A scene type:** follow the `add-scene` skill. One file in `runtime/scenes/`, a spec interface, a header
  block that `reel scenes` reads, one import line in `runtime/scenes/index.ts`, then regenerate
  `references/scenes.md` with `reel scenes --md`. A unit test fails when the two differ.
- **A command:** one file in `commands/`, a line in the command table in `reel.ts`, a row in the README table.
- **A QA gate:** one file in `qa/gates/`, its thresholds in `qa/thresholds.ts`, a row in
  `references/qa-gates.md`, and an e2e scenario that the gate must catch.
- **Anything a user sees:** update the skill or reference that describes it in the same change.

## Before a release

Run the `release` skill in `.claude/skills/`. It walks the checks and the version bump.
