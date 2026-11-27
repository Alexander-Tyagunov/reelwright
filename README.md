# Reelwright

Reelwright is a Claude plugin that makes short videos. Ask for a film and Claude finds the facts, proposes several
looks, builds one real shot for you to judge, then animates and renders the rest in Blender, lays words and sound
over it, measures it and has it reviewed. For recurring clips (release notes, metrics, explainers) it turns one
JSON file into a checked MP4 in minutes.

The plugin is in [`plugin/`](plugin/). Its guide, with the commands, the agents and what it needs, is
[`plugin/README.md`](plugin/README.md).

![Sixteen shots of one film made with Reelwright](plugin/docs/img/film-still.jpg)

## Install from GitHub

Add this repository as a plugin marketplace, then install the plugin from it:

```bash
claude plugin marketplace add OWNER/reelwright
claude plugin install reelwright@reelwright
```

To try the plugin from a checkout without installing it: `claude --plugin-dir ./plugin`.

A film made in Blender needs Blender 5.x with a Blender MCP server connected; the engine needs Node 24, ffmpeg and a
Chromium-family browser (`node plugin/skills/video/scripts/reel.ts doctor` says what is missing).

## Develop and test

Node 24 or newer. TypeScript runs directly; there is no build step.

```bash
npm install
npm run check        # typecheck, lint and unit tests; run before you call a change finished
npm run test:e2e     # whole-pipeline scenarios; need Chrome and ffmpeg; slow
claude plugin validate .            # the marketplace
claude plugin validate ./plugin     # the plugin
```

Conventions for contributors and agents are in [`CLAUDE.md`](CLAUDE.md).

## Repository

| Path | What it holds |
|---|---|
| `plugin/` | The installable plugin: skills, agents, the TypeScript engine, the Blender library, templates and references |
| `.claude-plugin/marketplace.json` | Lists the plugin for `claude plugin marketplace add` |
| `tests/` | Unit tests for business rules and end-to-end scenarios that run the real CLI |
| `docs/` | [Architecture](docs/ARCHITECTURE.md), [known issues](docs/KNOWN-ISSUES.md), [testing](docs/TESTING.md), [submission notes](docs/SUBMISSION.md) |

## Licence

MIT. Bundled fonts: SIL Open Font License 1.1.
