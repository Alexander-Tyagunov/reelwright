---
paths:
  - "tests/**"
---

# Tests

- A test exists because a real user scenario or a known edge case needs it. Name it after the scenario:
  `a title with an eight-word subtitle in 3.5 s fails the holds gate`.
- Do not add a test to raise coverage, and do not assert on implementation details.
- `tests/unit`: business rules that need no browser. Fast; run on every change.
- `tests/e2e`: the real CLI on real films. Each seeded-defect film must be caught by its gate, and a clean film
  must pass. Skip with a clear message when Chrome or ffmpeg is missing. One render at a time.
- When a gate or a threshold changes, change its scenario in the same commit.
- Never weaken a scenario to make it pass. If the behaviour is right and the scenario is wrong, say why in the
  commit message.
