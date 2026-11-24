---
paths:
  - "plugin/skills/video/scripts/**/*.ts"
  - "tests/**/*.ts"
---

# TypeScript in this repository

- Node 24 runs these files directly. Use erasable syntax only: no `enum`, `namespace`, parameter properties or
  decorators. Import with the `.ts` extension; import types with `import type`.
- ts.dev conventions, enforced by Biome: named exports, `const` by default, no `any`, no non-null assertion,
  80 columns, single quotes, semicolons. Two things may run past 80: a test name, and the header block of a
  scene file that `reel scenes` reads.
- A process that starts a browser, an encoder or a server registers it with `core/cleanup.ts`, so a stop signal
  ends it. Options that take a number go through `core/validate.ts`.
- One responsibility per file. Aim for under 200 lines; split before 300. Functions under about 40 lines.
- Every file starts with a `@fileoverview` TSDoc block. Every export has TSDoc that states what it guarantees
  and the unit of every number (seconds, pixels, frames, levels).
- A comment inside a function is one line of plain, active English, and only when the code cannot say it.
  No code in comments. No commented-out code.
- Do not name an outside article, post, person or product as the source of an idea.
- A failure the user can cause throws `UserError` with what went wrong and what to do next.
- Subprocesses get argument arrays. Nothing goes through a shell.
- Run `npm run check` before you finish.
