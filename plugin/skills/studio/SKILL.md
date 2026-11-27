---
name: studio
description: Keeps the owner's studio profile and look ledger - who his films are for, his positioning and voice, what he accepted and rejected in his own words, fixed brand elements, motifs, intro and outro habits, formats and platforms, and one ledger entry per finished film (medium, palette family, type, texture, camera language). Use when the user says "remember that I like", "remember that I don't like", "note this for next time", "this is my style", "set up my channel profile", "what looks have we used", "same as last time", "update the ledger", or corrects or approves a look. The film and publish skills read it at the start of every film and every publishing kit.
---

# Studio profile and look ledger

Two files in the owner's films folder steer every film: `studio/PROFILE.md` (his taste, in his words) and
`studio/ledger.json` (the looks already used). The film and publish skills read them; this skill creates and
updates them. Templates: `${CLAUDE_SKILL_DIR}/references/profile-template.md` and
`${CLAUDE_SKILL_DIR}/references/ledger-template.json`.

The films folder is the one the owner named, or `films/` under the current working directory. Find the files with
Glob (`**/studio/PROFILE.md`), or `find . -path '*/studio/PROFILE.md'` where there is no Glob tool, before assuming
there are none.

## Read (start of every film and every publishing kit)

1. Read `studio/PROFILE.md` and `studio/ledger.json`. If neither exists, say so in one line and continue; do not
   stop to create them.
2. Pass on what applies: audience, voice, platforms and formats into the brief; "Accepted" and "Rejected" and
   fixed brand elements to the director; the last five ledger entries to the director, who must differ from them
   on medium or palette family unless the owner asked for a series.
3. The owner's words in the current request win over the profile. Note any conflict in the brief ("profile says
   16:9 only; this request asks for a vertical cut") and follow the request.

## Update (whenever the owner corrects or approves a look)

When he corrects a sample, rejects a look, approves one, or says what he likes, offer once, in one line, to record
it: "Shall I note that in your studio profile?" On yes:
1. Add a dated row to "Accepted" or "Rejected": his exact words in quotes, what they were about (the film and the
   shot or still), and what was done instead. Quote; do not summarise his words into yours.
2. If he fixed something for every film ("always this title face", "never a tagline"), add it under "Fixed".
3. Show him the lines you added.

Write only what he expressed. Do not infer a taste from one film ("he likes paper") and do not fill empty
sections with guesses; an empty section stays empty with "not stated yet". A pattern you notice may go under
"Notes from the maker" marked as yours, never under his words. Palette and type go under "Fixed" only when he
fixed them; otherwise each film develops its own.

## Start a profile

When there is none and the owner wants one, or at delivery of his first film:
1. Copy the template to `studio/PROFILE.md`. Fill only what the conversation already contains: the films made (under
   "Films so far"), his words on them, the platforms he publishes to. When he reports earlier verdicts without dates,
   date the row with today and write "reported" in the About column; a verdict he gave in reported speech ("I
   approved it") goes in as "(reported: approved)", not as a quote.
2. Ask at most one question, the one that matters most for the next film (usually who the films are for).
3. Leave every other section "not stated yet".
4. When he describes films already made, add one ledger entry per film from his words only, with `null` for every
   field he did not describe (camera, texture, date) and a `note` saying the entry was written from his account. Do not
   copy values from the template's example.

## Ledger entry (at delivery of every film)

Offer it with the hand-over; on yes, append one object to `films` in `studio/ledger.json`. If the file is
missing, create it as `{"version": 1, "films": []}`; the entry in the template is an example of the fields, not a
film of this owner's. Fields:
- `id`, `title`, `date` (ISO), `duration_s`, `formats`;
- `medium` (one phrase: "stop-motion paper craft on a desk"), `palette_family` (one phrase: "blue hour with warm
  practicals"), `type` (faces and how words appear), `texture` (grain, materials), `camera` (lens, aperture,
  movement, cuts);
- `series` (the id of the film this continues, or `null`), `link` (the film file or the published URL),
  `owner_verdict` (his words, quoted, or `null`).

Describe what is on screen, in words another director can compare against. Validate the file afterwards:
`node -e "JSON.parse(require('fs').readFileSync('studio/ledger.json','utf8'))"` must print nothing.

## Compare (when the director or the owner asks "what have we used")

List the last five entries as a table: title, medium, palette family, camera. Say which medium and palette
families are free. Do not turn the list into looks to avoid; it is a record of what exists.
