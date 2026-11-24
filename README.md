![Reelwright: video from a spec, checked before it ships](plugin/docs/img/banner.png)

# Reelwright

Reelwright is a Claude plugin that makes short videos from code: release videos, explainers and animated
metrics. A film is one JSON file. A headless browser draws every frame as a function of time, ffmpeg encodes it,
and a quality gate measures the result before you see it.

The full guide is in [plugin/README.md](plugin/README.md).

## Repository

| Path | What it holds |
|---|---|
| `plugin/` | The installable plugin: skills, agents, the TypeScript engine, templates and references. |
| `tests/` | Unit tests for business rules and end-to-end scenarios that run the real CLI. |
| `docs/` | Architecture, known issues, research notes and submission notes. |
| `CLAUDE.md` | Conventions and commands for agents and contributors. |

## Develop

Node 24 or newer. TypeScript runs directly; there is no build step.

```bash
npm run check        # typecheck + lint + unit tests; run before you call a change finished
npm run typecheck    # tsc for the Node side and for the browser runtime
npm run lint         # biome check .  (npm run fix applies formatting)
npm test             # unit tests, no browser
npm run test:e2e     # whole-pipeline scenarios; need Chrome and ffmpeg; slow
claude plugin validate ./plugin
node plugin/skills/video/scripts/reel.ts doctor
```

## Install

```bash
claude plugin marketplace add <this repo>
claude plugin install reelwright@reelwright
```

To try the plugin from a checkout without installing it:

```bash
claude --plugin-dir ./plugin
```

## Licence

MIT. Bundled fonts: SIL Open Font License 1.1.
