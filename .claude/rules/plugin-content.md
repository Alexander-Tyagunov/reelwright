---
paths:
  - "plugin/skills/**/*.md"
  - "plugin/agents/**/*.md"
---

# Skills, agents and references

- Skill frontmatter is `name` and `description` only. The folder name equals `name`. Any other field stops the
  plugin loading in the Claude app.
- A description says what the skill does and when to use it, with the words a request would contain. It is the
  only part read before the skill loads. Keep it under 1,024 characters.
- Skills reach the engine as `${CLAUDE_SKILL_DIR}/scripts/reel.ts` (from `video`) or
  `${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts` (from the others). Agents use
  `${CLAUDE_PLUGIN_ROOT}/skills/video/scripts/reel.ts`. Never write an absolute path.
- Each agent pins `model` and `effort` in its frontmatter. Use the cheapest tier that does the job; the
  reasoning is in `references/model-routing.md`. An agent's `tools` line must cover what its body asks for.
- Write instructions as plain sentences that give the reason. Do not write rules in capitals or stack "never"
  lines. Say what finished means. Give limits as numbers.
- Limits used everywhere: one render command at a time, at most 3 fix rounds on the same failure, at most 2
  review rounds.
- Keep a skill under about 150 lines. Longer material goes in `skills/video/references/`.
- When a command, flag, scene field or threshold changes, change the skill and reference that mention it in the
  same commit. A reviewer checks docs against behaviour.
