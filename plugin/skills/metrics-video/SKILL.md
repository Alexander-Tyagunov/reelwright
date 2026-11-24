---
name: metrics-video
description: Turn numbers into a short animated video with Reelwright - KPIs, a monthly or quarterly metrics update, benchmark results, survey results, growth charts or a dashboard summary. Use when the user asks for an animated chart, a metrics or KPI video, a data story, a results recap clip, or to visualise numbers or a CSV as video.
---

# Metrics video

One video, one conclusion. The viewer cannot pause to study a chart, so every scene states its point in the
heading and the chart is the evidence. Follow the pipeline in `${CLAUDE_SKILL_DIR}/../video/SKILL.md`;
this file changes steps 2 to 4. CLI: `node ${CLAUDE_SKILL_DIR}/../video/scripts/reel.ts <command>` (written
`reel` below). If that folder is not next to this one, load this plugin's `video` skill and use the CLI path it gives.
Start from the template: `reel init <dir> --template metrics`.

## Facts (step 2)

Load the data and compute with code (Python or Node), never by eye: totals, change versus the previous period,
ranks, the max and min. Write `content.json` with every figure that will appear on screen, its unit, its period
and where it came from (file and column). For large files, `reel-ingest` does the extraction; the arithmetic
is still run in code and saved. Round for the screen (3 significant figures) and keep the exact value in
`content.json`.

## Storyboard (step 3)

| # | Scene | Seconds | Content |
|---|---|---|---|
| 1 | `title` | 3 | What was measured and the period. |
| 2 | `metric` | 4 to 5 | The 1 to 3 headline numbers, each with its change. |
| 3 | `bar-chart` or `line-chart` | 5 to 7 | The comparison or trend behind the headline. Heading states the finding. |
| 4 | optional second chart or `compare` | 5 to 7 | The one breakdown that explains why. |
| 5 | `bullets` or `outro` | 4 | What it means or what happens next, in at most 3 points. |

Choosing the form:
- A value over time is a `line-chart`; categories compared is a `bar-chart`; before and after is `compare` or two
  `metric` tiles; a single figure is a `metric`.
- At most 10 bars, at most 3 lines, at most 3 metric tiles. More than that is two scenes or a table in a document.
- Highlight the one bar or series the heading is about and leave the rest neutral.
- Headings state the finding ("Signups doubled after the redesign"), not the axis ("Signups by month").
- Start bar charts at zero. Say the unit once, in the heading or the value labels.
- Mark a decline as `good: true` when lower is better (latency, cost, churn), so colour follows meaning.

## Spec (step 4)

Copy numbers into `film.json` from `content.json`, not from memory. After stills, compare every on-screen number
against `content.json` once more before rendering; a wrong digit is the failure nobody forgives in a metrics
video. Then continue with render, QA and export as the pipeline says.
