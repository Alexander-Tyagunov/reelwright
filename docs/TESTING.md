# Test report

What was run against Reelwright 0.1.0 and what came out. Machine: a 2-CPU Linux container, Node 24.22.3,
ffmpeg 6.1.1, Chrome for Testing 153, software rendering (no GPU). Run on 23 to 24 November 2026.

## Summary

| Check | Result |
|---|---|
| `npm run typecheck` (TypeScript 7, Node side and browser runtime) | Pass |
| `npm run lint` (Biome 2.6.8, ts.dev rules) | Pass, 0 errors |
| `npm test` (unit) | 152 of 152 pass, 2 s |
| `npm run test:e2e` (real CLI, Chrome and ffmpeg) | 43 of 43 pass, 7 min 12 s |
| `claude plugin validate ./plugin` and `.` | Pass |
| Templates at 16:9, 1:1, 4:5 and 9:16, page gates | 16 of 16 pass |
| Sample films, full gate | 8 renders, 8 pass |
| Dependencies | 3 dev packages, 0 deprecated, 0 known vulnerabilities; the plugin itself has none |
| File size | 120 engine files, 14,375 lines; largest file 283 lines |

## What the end-to-end scenarios prove

Each scenario builds a film with one seeded defect and requires the named gate to fail, or runs a real task and
checks the result. A clean film must pass everything.

| Area | Scenarios |
|---|---|
| Determinism | `Math.random()` in a frame; a counter kept between frames |
| Layout | A heading half off the frame; two texts in one place; text almost the background colour; a label that is off-frame only mid-scene |
| Reading time | A 14-word title shown for 1.4 s |
| Load | No scenes; an unknown scene type; a metric with a misspelt field; a custom scene that throws at 4 s (named with its time, no stack trace); a custom scene with a syntax error (file named) |
| Motion | A 6.5 s static scene against a 4 s limit; a loop whose last frame does not meet the first; a loop that closes |
| File | A 1280x720 video checked against a 1920x1080 film; a render older than the spec; a draft render alone; a video path that does not exist |
| Verdict | No render gives INCOMPLETE and exit 1; `--page-only` passes; `--size` writes its own report |
| Render cache | A second render reuses every scene; editing scene 2 re-renders scenes 2 and 3 only |
| Delivery | `export --preset x --audio` lands at -14 LUFS within 1 and at or below -1 dBTP; `build` writes one HTML file that plays from disk; a typed `.ts` project scene renders |
| Lifecycle | A render stopped with SIGTERM leaves no Chrome, no ffmpeg and no temporary files; a failed scene stops the other encoders; a custom temp folder is left empty; a bad `--at` keeps the stills that were there; out-of-range options name the option, the value and the range |
| Templates | Every template passes the page gates at four sizes; the release template passes the full gate |

Unit tests cover the rules that need no browser: freeze detection and limits, reading-hold arithmetic, contrast
ratios, pixel comparison, timeline and transition maths, argument parsing, spec loading and its ranges, the
local server (bound address, hidden files, links out of the project, foreign Host), the report and verdict, and
that `references/scenes.md` matches what `reel scenes --md` prints.

## Sample films

| Film | Size | Length | Render | Speed | Verdict |
|---|---|---|---|---|---|
| Release template | 1920x1080 | 25.1 s, 753 frames | 48.6 s | 15.5 fps | PASS |
| Release template | 1080x1920 | 25.1 s | 49.7 s | 15.2 fps | PASS |
| Metrics template | 1920x1080 | 26.7 s, 801 frames | 53.1 s | 15.1 fps | PASS |
| Metrics template | 1080x1080 | 26.7 s | 39.5 s | 20.3 fps | PASS |
| Explainer template | 1920x1080 | 40.8 s, 1,224 frames | 76.4 s | 16.0 fps | PASS |
| Tessera 3.2.0 release film (agent-built) | 1920x1080 | 33.4 s, 1,001 frames | 62.6 s | 16.0 fps | PASS |
| Tessera 3.2.0 release film | 1080x1350 | 33.4 s | 49.9 s | 20.1 fps | PASS |
| Rollout ramp (bespoke scene) | 1920x1080 | 14.3 s, 429 frames | about 29 s | 15 fps | PASS |

A second render of an unchanged film took 1.0 s: all five scenes were reused. For the release template,
stills took 1.5 s and the page gates alone (`qa --page-only`) took 7.1 s.

## The agent chain, end to end

One release film was made the way the plugin intends, each step by the agent and model the plugin assigns, from
an invented changelog (Tessera 3.2.0).

| Step | Agent | Model | What happened |
|---|---|---|---|
| Facts | `reel-ingest` | Haiku, low | 20 facts extracted in 26 s, each with its source line. All 20 were correct. |
| Storyboard | `reel-director` | Opus, high | Six scenes with exact words and seconds in 92 s. |
| Build | `reel-builder` | Sonnet, medium | Spec plus three small project scenes. All gates passed at 16:9 after one fix round. |
| Bespoke scene | `reel-auteur` | Fable, high | A 200-dot rollout ramp with a pause and resume. Determinism, layout and motion passed first time; one label was 0.06 s short of its reading time. |
| Review | `reel-reviewer` | Opus, medium | 15 commands, about 3 minutes, about 101k tokens. Verdict "fix first", five corrections, every on-screen number checked against the facts. |

What the review found is the useful part, because every gate had passed:

1. Numbers that improved by dropping counted up from zero. The spec now counts down from the old value.
2. The portrait cut set three code lines at 2.4% of the short side, under the 2.6% minimum. The code scene's
   floor was below the gate's; it is now 2.7.
3. Hyphens were drawn too wide. Tabular figures were on for all text; they are now only on counting numbers.
4. The outro said "Flag changes in under 400 ms" where the facts say median. The wording was corrected.
5. The benefit line on the last frame is small beside the title. Left as it is; it is a judgment call for a
   person.

Findings 2 and 3 were defects in the engine, not in the film, and are fixed for every film.

## Independent code review

A reviewer on Opus that had not seen the code being written read the repository against the project's quality
rules and ran the CLI with bad input. It reported 21 findings: 6 major, 11 minor, 4 small. All are addressed.

| Finding | Fix |
|---|---|
| A stopped or failed render left Chrome and ffmpeg running | Cleanup registry; stop signals end every child and remove temporary files |
| The local server served hidden files, followed links out of the project and accepted any Host | All three refused; tests added |
| A misspelt field drew "NaN" and passed | Scenes check their fields; the layout gate fails placeholder text |
| A scene that threw was blamed on the wrong gate, with a stack trace | Guarded frame code; the load gate draws every scene; one-line message |
| Recipe skills could not name the engine when their sibling folder is absent | Each names the path and a fallback |
| A strip overwrote the scene stills; a bad time emptied the folder | Strips have their own folder; times are checked before anything is removed |
| A flag before the spec path swallowed it | Known boolean flags never take a value |
| Out-of-range sizes, frame rates and ports gave stack traces or wrong output | One validation module with ranges |
| Draft size documented as a quarter, actually a half | Doc and constant corrected |
| Every loop warned about blank ends | Skipped for loops |
| Draft-only render said "run render first" | Says a draft is not checked |
| Loudness numbers duplicated | Imported from the thresholds file |
| Chrome left a temp folder per launch | Its temp folder is inside the profile folder that is removed |
| An experimental Node API is used to serve TypeScript to the browser | Documented with its risk in known issues; `doctor` checks it |
| A test that could not fail; missing scenarios | Test rewritten; 28 unit tests and 10 end-to-end scenarios added |
| Eight functions over 40 lines | Split; stills before and after are byte-identical (56 of 56) |
| README inaccuracies | Corrected |
| `scenes.md` "generated" by nothing | `reel scenes --md` generates it; a test compares them |
| Reports written to surprising places | Named after the video; none for a missing file |
| Custom-scene errors without context | Scene number, type and file added |
| Lines over 80 columns | Split, except test names and the scene header blocks a generator reads |

One further defect was found while rendering the delivery samples, not by any reviewer: three metric tiles ran
10 px past a square frame. Stacked tiles now shrink to fit, and the template scenarios include the square size.

## What was not tested

- Chat on claude.ai and Cowork as live surfaces. The plugin follows their documented rules and passes
  `claude plugin validate`; installing it there was not possible from this environment.
- The directory's own safety scan and policy review, which run at submission.
- macOS and Windows. The code has no platform-specific paths beyond browser discovery, which lists the usual
  locations for all three systems.
- GPU rendering (`--gpu`). All numbers above are software rendering on two cores; a laptop will be faster.
- Rhythm, feel and sound. The gates measure and the reviewer looks at stills. Nobody has pressed play.
