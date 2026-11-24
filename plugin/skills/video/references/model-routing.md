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
to `sonnet`. The gates do not depend on the model, so quality control is unchanged.
