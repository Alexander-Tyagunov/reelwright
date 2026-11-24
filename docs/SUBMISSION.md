# Submitting Reelwright to the Anthropic plugin directory

Checked against the submission guide and the pre-submission checklist on 23 November 2026. The portal's own
**Validate** step is the authority; this page records what was prepared for it.

## Steps

1. Push this repository to GitHub. It can stay private while you validate; it must be public to go live.
2. On claude.ai, connect the GitHub account that can push to the repository.
3. Open `claude.ai/directory/manage`, choose **Submit new**, then **Plugin bundle**.
4. Source: the repository, plugin path `plugin`, branch empty for the default branch.
5. Select **Validate**. Fix anything marked **Blocking**, push, validate again.
6. Listing details come from `plugin/.claude-plugin/plugin.json` and `plugin/README.md`.
7. Data handling answers: reads no personal data, sends no data to any service, keeps nothing, not aimed at
   people under 18.
8. Submit for review, then select **Publish** once the version passes.

## Before you push

- Set `author.name` (and optionally `author.url`) in `plugin/.claude-plugin/plugin.json` and `owner.name` in
  `.claude-plugin/marketplace.json` to the name you publish under.
- Add `repository` and `homepage` to `plugin.json` once the GitHub URL exists, and replace `<owner>/<repo>` in the
  Install section of `plugin/README.md` and `<this repo>` in the root `README.md`.
- Run `npm run check`, `npm run test:e2e` and `claude plugin validate ./plugin`.

## How the plugin meets the checklist

| Requirement | Status |
|---|---|
| Folder with `.claude-plugin/plugin.json` | `plugin/` |
| Name: lowercase, distinctive, not a known brand, not taken | `reelwright`. No listing of that name was found in the directory search and no product of that name on the web on 23 November 2026. Earlier working name "Motion Studio" was dropped: it is an existing product name and resembles the listed `animation-studio`. The portal confirms availability at Validate. |
| `description`, `author`, `version` set | Yes |
| README of at least 40 words in the plugin folder | `plugin/README.md`, including what the plugin runs and that it sends no data |
| Licence | `plugin/LICENSE` (MIT) and `license` in the manifest |
| Icon, square PNG 512 px or more | `plugin/.claude-plugin/icon.png` |
| No `.DS_Store`, symlinks, submodules or LFS pointers | None |
| Every non-image, non-font file under 256 KiB; at most 512 files | Largest source file is a few KiB |
| Only text, images and fonts | TypeScript, Markdown, JSON, CSS, HTML, PNG, SVG, WOFF2 |
| No package launchers, no lockfile install in the plugin folder | None; dev tooling is at the repository root |
| No credentials, no reading of environment credentials | None |
| No hooks, no MCP servers | None |
| Skill frontmatter is `name` and `description` | Yes, so the skills load in chat, Cowork and Claude Code |
| No top-level `bin/` | None |
| Readable source, nothing compiled or minified | TypeScript run directly by Node |

## Things a reviewer may ask about

- **Bundled fonts.** The stylesheet loads Inter and JetBrains Mono from `runtime/fonts/`. Both are under the
  SIL Open Font License; the licence files sit beside them.
- **Local processes.** The engine starts headless Chrome, runs ffmpeg and ffprobe, and serves the project
  folder on 127.0.0.1 while a command runs. The README states this.
- **`--no-sandbox`.** Passed to Chrome only when the process runs as root, which Chrome requires in containers.

## What each surface loads

| Surface | Skills | Agents | Rendering |
|---|---|---|---|
| Claude Code | Yes | Yes | On the machine: Node 24, ffmpeg, a Chromium-family browser |
| Cowork | Yes | Yes | In the session's workspace when it has those tools |
| Chat on claude.ai | Yes | Ignored by design | In the code-execution sandbox when it has those tools; `reel doctor` reports what is missing |

## Updates

Raise `version` in `plugin.json` on every release. The directory follows the tracked branch and scans each new
commit; a version that passes is published according to the plugin's publish setting.
