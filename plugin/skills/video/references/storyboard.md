# Storyboard rules

The storyboard is where a film is won or lost. It is cheap to change and everything downstream follows it.

## Format

```markdown
Viewer: existing customers, in the product newsletter and on X
Remember: exports are three times faster in 2.4
Length: 28 s, 1920x1080 (also 1080x1350)

| # | Type | s | On-screen copy | Moves | Job |
|---|------|---|----------------|-------|-----|
| 1 | title | 3.5 | kicker "Acme 2.4" / title "Exports are three times faster" | words rise in | the headline |
| 2 | metric | 5 | "Before" 184 s / "After" 58 s, chip "3.2x faster" | numbers count up | the proof |
```

Write the exact words. "A title about speed" is not a storyboard row.

## Numbers

| Rule | Value | Why |
|---|---|---|
| Reading hold | 0.3 s per word + 0.5 s, counted from when the text has landed | The QA gate fails holds under 70% of this and warns below 100% |
| Words per block | title 3 to 8, subtitle up to 12, bullet 2 to 7, chart heading up to 9 | Longer text shrinks to fit and stops reading as video |
| Scene length | 3 to 8 s; under 1.5 s or over 12 s draws a warning | Short scenes cannot be read, long ones stall |
| Scene minimum | entrance and stagger (about 1.5 s for a title with subtitle, about 1 s otherwise) + the longest reading hold + 0.4 s for the fade | A title with a 6-word title and an 8-word subtitle needs about 1.6 + 2.9 + 0.4 = 4.9 s |
| List scenes | about 1 s per item + 2.5 s | Items appear one at a time |
| Longest still stretch | 4 s (`meta.maxHold`) | Beyond that a video looks frozen |
| Film length | social clip 12 to 30 s, release 20 to 45 s, explainer 45 to 90 s | Completion drops quickly after a minute |
| Scene count | about one per 4 to 6 s | |

A quick check before building: add up the durations, subtract 0.45 s for each transition and 0.5 s for the lead-in, and
compare with the target length. `reel qa film.json --page-only` reports the exact hold of every text block before anything is rendered.

## Structure

Most short films use one of three shapes.

- **Announcement:** headline, proof, details, where to get it.
- **Data story:** what was measured, headline number, the evidence, what it means.
- **Explanation:** the question, the familiar starting point, one step per scene, the takeaway, where to learn more.

Open on the most interesting true thing, not on a logo. Close on a frame that still makes sense as a thumbnail.

## Copy

- Benefits before mechanisms: "Exports finish 3x faster", not "New streaming export worker".
- Concrete nouns and numbers from the facts; no adjectives that need trust ("blazing", "seamless").
- One name per thing for the whole film.
- Sentence case. No full stop on headings. Numbers as digits.
- If a claim has no figure in the facts, it gets no figure on screen.

## Rhythm

Alternate dense and simple scenes. Do not use the same scene type three times in a row. Put the strongest
visual (a number, a chart, a screenshot) in the first third.
