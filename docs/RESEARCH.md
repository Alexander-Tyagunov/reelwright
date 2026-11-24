# Code-drawn video with Claude: what is real and what is hype

Research notes behind Reelwright. Compiled 23 to 24 November 2026 from three viral X posts, the articles
and repositories they point to, and Anthropic's own documentation. Each claim below is marked as verified
against a primary source, partly right, or not verifiable.

## The three posts

| Post | What it is | Reach when read |
|---|---|---|
| @flxrnc, 22 Nov: "these 15 GitHub repos" | A list of 15 repositories that quotes and funnels to her 10 Nov article, "The Fable 5.2 Motion Playbook: One Prompt, One Film" | 119K views; the article 1M |
| @seeconvm, 16 Nov: "Motion Design with Fable 5.2 ... (Full Course)" | A 20-section beginner guide | 380K views |
| @beamnxw, 9 Oct: "Motion Engineering with Opus 5.5: Build Launch Videos You Can Sell" | A Remotion workflow with frame-numbered briefs, plus a "sell it for $150" section | 1.1M views |

Two observations about the genre before the content:

- The @seeconvm course is largely the @flxrnc playbook re-edited. The starter prompt, the render script, the
  spring table, the QA block, the cost table and the "when it goes wrong" list are the same text with the mascot
  renamed. A third account's article from 15 Nov carries the same opening passages. Treat view counts as a
  measure of packaging, not of independent confirmation.
- All three end with "bookmark this" and "follow me". The repo list in particular is built to be saved, not
  used: asked which repos matter, the author replied that they are all the best and to send them all to Claude.

The underlying technique is nevertheless sound, and Anthropic's own material supports most of it.

## What Anthropic says

- Fable 5.2 was released on 9 November 2026. Its product page has a section titled "Design for 3D, hardware,
  and motion" that says the model creates simulations, animations and educational videos with sound in code.
  Price: $8 per million input tokens and $40 per million output; fast mode is up to 2.5x faster at $16 / $80.
- The launch post recommends Opus 5.5 as the daily driver, moving up to Fable for the hardest work and down to
  Sonnet 5.5 or Haiku 5.5 for simpler tasks. It describes two roles for Fable in a team: an advisor that smaller
  models consult, and an orchestrator that delegates simpler work.
- The Fable 5.2 prompting guide: `high` effort gives most of the capability; gains above it are uneven; `max`
  is for measuring the ceiling. Medium is the default in the apps and Claude Code. The model sometimes ends long
  tasks early, more at low and medium, and a "Finishing work" block roughly halves that for about 30% more
  output tokens. "Think less" instructions do nothing at medium and above. Rules containing "never" are treated
  as absolute. Style rules are followed to the letter. A bare "continue" is weak; say what is approved.
  Subagents can be a large share of session cost, so check which model they use.
- Claude Code supports per-agent `model` (`haiku`, `sonnet`, `opus`, `fable`) and `effort` in agent files, an
  `advisorModel` setting, and plugins that bundle skills and agents. That is what this plugin is built on.
- Anthropic's own video-making skill is short and practical: look at full-size stills before the first render,
  render one file per scene and join without re-encoding, 30 fps unless asked for more, JPEG screenshots at
  quality 92 rather than PNG. Its concern is the person waiting on a render, which the viral posts ignore.

## Claim check

| Claim in the posts | Status | Notes |
|---|---|---|
| Fable writes a page that animates itself; you capture it frame by frame and encode with ffmpeg | Verified | Same architecture as Remotion and HyperFrames. |
| Every frame must be a pure function of time (`renderAt(t)`), no clocks, no unseeded randomness | Verified | Remotion's `useCurrentFrame()` rule and HyperFrames' contract say the same thing. This is the load-bearing idea. |
| Screen recording drops frames; frame-by-frame capture does not | Verified | |
| High effort beats Max for visuals | Verified in direction | Matches Anthropic's guide. Simon Willison's Max run spent 128,000 thinking tokens and returned no image. The per-effort dollar figures quoted ($3.10 to $26.54) are a benchmark's cost per task, not the cost of a video. |
| A model that checks stills will pass a frozen film | Verified | Jonathan Edwards' write-up: about 100 of 160 seconds frozen, passed by five checking sessions, caught when he pressed play. |
| A reviewer that did not build the work; numeric limits such as "at most 2 processes" | Verified | Same source: without a number, three of four runs started 7 to 10 processes; with it, all complied. |
| The "Finishing work" block halves early stops | Verified | From the prompting guide. It does not remove endings that list what remains, so define "done" concretely as well. One Claude Code write-up reports the block is already included for Fable 5.2 there; not confirmed. |
| The ownership sentence: "about half of tries, about 1.5x tokens" | Misquoted | The guide says under 10% to about 75%, with 70 to 80% more output tokens, and warns of unrequested changes. |
| "One leftover 'never retry' line cut retries from nearly all to about 4 in 10" | Not verifiable | The guide uses "never retry" as an example without that figure. |
| Changing effort mid-conversation keeps the prompt cache | Partly | True for the API's per-message effort beta. Not confirmed for `/effort` in Claude Code. |
| Remotion is free up to 3 people | Verified | Individuals, non-profits and for-profit companies of up to 3 employees. Larger companies pay. |
| GSAP is "100% free" | Verified, with a caveat | Free under Webflow's standard licence, which is not an open-source licence and can be amended. |
| Blender MCP sends anonymous usage data by default | Verified | `DISABLE_TELEMETRY=true` turns it off. |
| All 15 repositories exist and are active | Verified | See the table below for which ones matter. |
| "No code knowledge needed" | Overstated | The reliable path is Claude Code, ffmpeg and scripts: a developer workflow. |
| "One prompt, one film" | Overstated | The showcase film took a 2,039-word prompt and 24 follow-ups. The author says the follow-ups mattered more. |
| Small 2D films cost $3 to $10; big 3D runs $37 to $2,618 | Plausible, self-reported | An independent seven-film test measured $1.40 to $4.25 per short film on Fable and $0.22 to $0.46 on Sonnet. |
| "Launch videos you can sell" for $150 | Marketing | The post itself calls the price illustrative. The engineering underneath it is the most careful of the three. |

## The 15 repositories, sorted by usefulness for this job

| Repository | Verdict for release notes, explainers and metrics |
|---|---|
| FFmpeg | Required. Encoding, joining, measuring. |
| Remotion + Remotion Skills | Real and mature. The right choice inside a React codebase or for a video product. Licence cost for companies over 3 people. |
| HyperFrames | Real and agent-friendly (non-interactive CLI, a `check` gate). Pre-1.0, telemetry on by default, tied to HeyGen's paid services. |
| GSAP | Real. Useful for timeline-heavy custom scenes if driven from `t`. Its skills target scroll-driven websites. |
| three.js, Blender MCP | Real, for 3D. Not needed for text and data films. |
| Manim | Real, for mathematics. Heavy install; use it for that one kind of scene. |
| huashu-motion | Interesting director-style workflow, but five weeks old with a single author. Read it, do not depend on it. |
| Excalidraw, Rough.js | Diagram and sketch tools. A look, not a pipeline. |
| Magic UI, ui-ux-pro-max, Taste Skill, Impeccable | Website UI tools and web-design rule sets. Not video tools. Loading them adds context that does not apply. |

Five of fifteen matter. The list reads as a toolbox, but most of it is from a different trade.

## What holds up, and what Reelwright does with it

1. **The frame contract.** Kept as the core, and enforced: the gate draws frames cold and in sequence and fails
   the film if they differ.
2. **Numbers, not adjectives.** Kept as the storyboard format (exact words, seconds) and the correction format
   (where, what was observed, the change, what stays fixed), which comes from the Remotion post.
3. **Measure motion; stills lie.** Kept and extended. The posts measure freezes and loop seams. Because the
   film is a DOM, this plugin also measures things the posts check by eye: text outside the safe area, clipping,
   overlap, contrast, type size, and whether each block stays still long enough to be read.
4. **Stills before any render, one fix round on them.** Kept; after a render the plugin allows up to 3 fix rounds on the same failure. Agrees with Anthropic's own video skill.
5. **A reviewer that did not build it; limits as numbers; short rulebooks.** Kept: a separate review agent on a
   different model, "at most 2 renders, at most 2 review rounds", and skills of about a page each.
6. **Effort and model discipline.** Kept and made structural: each agent pins the cheapest model that does its
   job.

## Where the posts would lead you wrong for business video

- **Regenerating a bespoke film every time.** The showcase approach has a frontier model write a new 500-line
  page per video. That is right for a one-off film and wasteful for a weekly release video. A scene library and
  a JSON spec turn the recurring case into a small edit that a mid-tier model does reliably, and make every
  film on-brand by construction.
- **Showpiece render settings.** 60 fps, PNG frames, CRF 16 and 32-sub-frame motion blur are for character
  films. For text and charts, 30 fps and JPEG capture look the same and render several times faster.
- **Character-animation craft applied everywhere.** Hero width in pixels, lenses, squash and stretch, sound one
  frame after the picture: real craft, wrong genre. The part that transfers is the principle of measuring what
  must be readable.
- **Max effort and overnight runs as proof of quality.** They are proof of spend.
- **Trusting any single pass.** Every source that ran this for real ends in the same place: the agent cannot
  watch or listen, so a person presses play once before publishing.

## A fourth post, read later: the stickman video skill

@AveryRunsAI, 22 Nov, "Complete steps on how to Make Viral Stickman Videos for YouTube for $0" (45K views),
promoting an open-source skill, `kaomei/stickman-video-director` (MIT, about 7,100 stars).

What it is: a skill with two engines. One writes prompts for a video-generation model and stitches the clips.
The other generates image assets, animates them in code and renders locally. It adds text-to-speech, a bundled
music and sound-effects library, captions and a publishing step.

| Idea | Verdict | What Reelwright does with it |
|---|---|---|
| Approve the script and a short preview before the full build | Sound. The cheapest moment to change direction | The pipeline stops after stills for long films and offers a draft render first |
| A "ship kit" at the end: title, description, thumbnail | Sound and cheap | The deliver step writes `out/export/post.md` and a poster frame |
| Reuse the same assets in every scene so characters stay consistent | Sound; it is the same reason Reelwright uses a scene library and brand tokens | Already the design |
| Fix one section instead of redoing the film | Sound | Per-scene render cache |
| Text-to-speech with word timestamps for captions | Useful, but needs a paid or keyed service | Not built in. The spec accepts `captions`, and export accepts a voice track the user supplies |
| A bundled music and sound-effects library | Licensing and attribution burden, and tens of megabytes | Left out |
| Video-generation models for the footage | A different product: cost per clip, no exact timing, no measurable layout | Out of scope; see `references/engines.md` |
| "$0", "viral", "500 Shorts analysed" | Marketing. The $0 route still spends the assistant plan's quota and free-tier limits | Ignored |

The README of that repository does not describe any automated check of the output. Its quality control is the
person approving previews, which is the gap Reelwright's measured gate fills.

## Sources

- Anthropic: [Claude Fable 5.2 product page](https://anthropic.com/claude/fable); [launch post](https://www.anthropic.com/news/claude-fable-and-mythos-5-2); [Prompting Claude Fable 5.2](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2); Claude Code docs on [subagents](https://code.claude.com/docs/en/sub-agents), [skills](https://code.claude.com/docs/en/skills), [plugins](https://code.claude.com/docs/en/plugins-reference) and the [advisor](https://code.claude.com/docs/en/advisor)
- Posts: [@AveryRunsAI stickman guide](https://x.com/AveryRunsAI/status/2124444676937621723); [@flxrnc repo list](https://x.com/flxrnc/status/2124608918899118512) and [Motion Playbook](https://x.com/flxrnc/status/2120207374250049675); [@seeconvm course](https://x.com/seeconvm/status/2122405510779375668); [@beamnxw Motion Engineering](https://x.com/beamnxw/status/2108616740846420354)
- Field reports: [Jonathan Edwards, "Fable 5.2: A guide to the best model in the world"](https://limitededitionjonathan.substack.com/p/the-best-model-in-the-world); [Simon Willison on effort levels](https://simonwillison.net/2026/Nov/9/llm-anthropic/); [iArt, seven motion prompts on three models](https://www.iart.ai/blog/fable-5-2-motion-graphics)
- Repositories read: the 15 in the list (Excalidraw, Rough.js, Manim, huashu-motion, Magic UI, ui-ux-pro-max-skill, GSAP, Taste Skill, Impeccable, three.js, Blender MCP, HyperFrames, Remotion, Remotion Skills, FFmpeg) and five more that the linked playbook names (remotion-dev/claude-code-plugin, greensock/gsap-skills, bradautomates/claude-video, Vanilagy/mediabunny, ChromeDevTools/chrome-devtools-mcp).
