# Which model does what

The rule: a strong model decides what the film says, a cheaper model builds it, scripts measure it, and the
strongest model is called only for the one thing nothing else can draw. Subagents can be a large share of what a
session costs, so every agent in this plugin pins its model instead of inheriting the session's.

| Job | Agent | Model | Effort | Why this tier |
|---|---|---|---|---|
| Extract facts from changelogs, CSVs, long documents | `reel-ingest` | Haiku | low | Mechanical reading and copying. Accuracy comes from the rules (cite every item, run arithmetic in code), not from model strength. |
| Run renders, QA and exports; report numbers | `reel-runner` | Haiku | low | Command execution. Keeps long logs out of the main context. |
| Write `film.json`, fix gate failures, add 2D scenes | `reel-builder` | Sonnet | medium | Well-specified coding against a documented API, verified by gates. |
| Decide message, structure and exact copy | `reel-director` | Opus | high | The idea is the film. Few tokens, large effect. |
| Independent review before publishing | `reel-reviewer` | Opus | medium | Visual judgment and a different model from the builder. |
| A bespoke 3D, physics or illustration-level scene | `reel-auteur` | Fable | high | The one place the top tier is measurably better. |
| Blender film: pitches, treatment, shot plan | `reel-director` | Opus | high | The look and the story are chosen here; about 350k tokens for a 90-second film, the largest effect on the result. |
| Blender film: build and animate one sequence, the sample shot, re-renders | `reel-animator` | Opus | high | Spatial reasoning in Blender's Python API, judged on its own strips and check frames. 350k to 420k tokens per sequence of 3 to 4 shots. |
| Blender film: assembly, overrides, render, gates, cut report | `reel-builder` | Sonnet | medium | Commands with documented inputs and measured outputs. 130k to 240k tokens a pass. |
| Blender film: independent review | `reel-critic` | Opus | medium | Did not make the film; fact check, AI-tell check, classed findings. About 180k tokens. |
| Everything deterministic: rendering, measuring, encoding | scripts | none | | Free, exact and repeatable. |

## Why these choices

- Anthropic's guidance for Fable 5.2 is to start most coding and knowledge work on Opus 5.5 and move up to Fable
  for the hardest work or down to Sonnet or Haiku for simpler tasks, and it describes Fable as a planner and
  orchestrator for smaller models and as an advisor they can consult.
- In an independent comparison of seven motion-graphics prompts on one harness, the same films cost roughly
  eight times more on Fable than on Sonnet and about 1.6 times more than on Opus. Fable won where the model had
  to supply the idea; the gap narrowed when the brief already contained it. Sonnet's failures were frozen end
  frames, overlapping captions and empty screen time, which are exactly what `reel qa` measures.
- So the idea comes from Opus (storyboard), the build goes to Sonnet, and gates catch the cheap model's typical
  mistakes. That gets most of the quality of the top tier for a fraction of its price.

## Blender films

The token figures above were measured on the first Blender film (93 seconds, 16 shots); a whole film came to
about 3 million tokens, most of it in the animators and the assembly passes. Two choices keep that down:
- The animator is Opus, not Fable. Its work is checked on strips and check frames at every step, so a strong
  model's first guess matters less than the loop; move it up only for a shot that defeats Opus twice.
- The next film in an existing world (a series) reuses the look module and rigs: `reel-builder` or one animator
  per film instead of a new treatment, pitches and sample.

`reel-animator` has no `tools` line. The Blender tool is an MCP tool whose prefix differs between setups (one
machine, or a workspace with a bridged Blender machine), and an agent's tool list cannot name an MCP server by a
pattern, so the agent inherits the session's tools and loads the Blender tool with ToolSearch.

Rendering costs time, not tokens: 10 to 24 s a pose in Cycles at 1080p on a laptop GPU, 12 poses a second, so 2
to 5 minutes per second of film. The film skill puts both figures in the treatment's budget.

## Session setup

- Run the main session on Opus 5.5 or Sonnet 5.5 at medium effort: `claude --model opus`.
- Optional: let the session consult Fable at decision points with `/advisor fable` (or `"advisorModel": "fable"`
  in settings). The advisor is called at decisions, not every turn.
- If you do work in Fable 5.2: high effort for a from-scratch build, medium for planning, stills and notes.
  Anthropic's guide says most of the capability gain arrives by `high`, that gains above it are uneven, and that
  `max` is for measuring the ceiling. For visuals, `max` buys thinking time, not better frames.
- In scripts, pin the model (`claude -p --model sonnet ...`) so a batch job does not inherit an expensive default.
- `CLAUDE_CODE_SUBAGENT_MODEL` overrides nothing here: frontmatter wins over it. To force one model everywhere
  (for example on a plan without Fable), set it together with `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`.

## What a film costs

List prices in November 2026, per million tokens (input / output): Haiku 5.5 $0.10 / $0.50 for prompts up to
100k tokens, Sonnet 5.5 $2 / $10, Opus 5.5 $4 / $20, Fable 5.2 $8 / $40. Check the pricing page before quoting.

With this plugin a typical 30-second film from clear material is one storyboard (a few thousand output tokens),
one spec of about 100 lines of JSON, and tool calls. It needs no code generation at all, which is why it is
cheap. Bespoke scenes are where cost goes: budget for them deliberately and keep them to the moment that needs
one.

## When not to delegate

A subagent starts cold and re-reads its context. For a short film from clear material, the main session doing
everything is faster and cheaper than three handoffs. Delegate when the source is long, the film is large or
multi-format, a custom scene is needed, or an independent review is worth it.

## Without Fable or Opus access

Change the `model:` line in the agent files: `reel-auteur` to `opus`, `reel-director` and `reel-reviewer`
to `sonnet`. For a Blender film, `reel-animator` and `reel-critic` can move to `sonnet` as well; expect more fix
rounds on the animator's strips. The gates do not depend on the model, so quality control is unchanged.
