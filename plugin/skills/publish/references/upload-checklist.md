# Upload checklist

What to write into each file of `publish/`, and the settings the owner enters on the upload form. Numbers were
checked on YouTube on 27 November 2026; search the web for the current rule before relying on any of them.

## Title (`titles.txt`)

- Up to 100 characters; the first 60 carry it, because that is what shows in lists and search.
- Say what the film is about in the viewer's words. A title that only makes sense after watching does not get
  the film watched.
- Three to five options, best first, each with one line on what it emphasises. Use the profile's voice and any
  fixed title form.

## Description (`description.txt`)

1. Two plain lines first: what the film shows, and for whom. They show before "more".
2. How it was made, in one or two sentences: for example "Made in Blender as stop-motion paper models on a desk,
   with generated sound. Planned and built with Claude." This is also part of the AI-content answer below.
3. The sources of the facts, one line, when the film states facts.
4. The chapters, copied from `chapters.txt`.
5. Links the profile lists.

## Chapters (`chapters.txt`)

`reel chapters film.json > publish/chapters.txt` prints one line per chapter from the film spec's scene starts:
the first at 0:00, each at least 10 s (shorter scenes merge into the one before), titles from the scenes'
`chapter` fields, else the label texts of the scenes in the chapter (about 60 characters at most), else the film title
and "Part N". The output is the timestamp lines only; notes go to stderr. YouTube needs the first at 0:00, at least three chapters, each at least 10 s
(checked 27 November 2026). Read the titles and shorten any that is a long list of names. If the film has fewer than
three chapters of 10 s, `reel chapters` prints nothing and says why on stderr: then `chapters.txt` is not part of the
kit (delete it or leave it empty), the description has no chapters, `settings.md` says "Chapters: none, the film is too
short", and the done-test for chapters does not apply. A Short takes no chapters here (not checked on YouTube's pages).

## Tags (`tags.txt`)

Tags matter little for discovery (checked 27 November 2026). Five to ten: the subject, the medium, the names that
appear in the film. No tags for things the film does not contain.

## Thumbnail (`thumbnail.jpg`, and `thumbnail-short.jpg` for a Short)

Regular video: 1280 x 720, 16:9, under 2 MB; a custom thumbnail needs a phone-verified account (checked 27 November 2026).
One subject, at most four words, readable at 160 px wide.

Short: a custom image is uploaded from YouTube Studio on a computer, 9:16, recommended 2160 x 3840, at least 640 px high, JPG
or PNG up to 50 MB, from a verified account (checked 27 November 2026; the help page gives no figure for the phone app).
Take a 9:16 frame from the vertical plate, `plates/<shot>@9x16/frames/<nnnn>.jpg`, at the plate's size (1080 x 1920 is above
the minimum and under the recommended size, say so), name it `thumbnail-short.jpg`, and check it at 160 px wide
(`ffmpeg -i publish/thumbnail-short.jpg -vf scale=160:-2 publish/thumbnail-short-160.jpg`). Keep the subject in the middle
third: the player covers the top and bottom with buttons and captions (not checked for exact areas). The two ways below
apply with the 9:16 size in place of 1280 x 720.

Two ways, cheapest first:
1. **A frame of the film, no words.** Pick the frame that carries the film (the signature moment, a character
   large in frame). Take it from the plate, which has no labels:
   `ffmpeg -i plates/<shot>/frames/<nnnn>.jpg -vf scale=1280:720 -q:v 3 publish/thumbnail.jpg`.
2. **A still in the film's look, with up to four words in the picture.** In Blender, build the shot's set with
   the film's look module, add the words as a card (`lettering.printed_text` or `lettering.hand_lettering`, run in
   the workspace, mixed into the card's paper by its alpha), and render it at 1920 x 1080: a preview with
   `stills.render_still_at`, the final through the render queue (the video skill's `references/blender.md`,
   sections 13 and 14). Then scale to 1280 x 720 as above. Words laid over a frame in a flat font read as a template; words that are
   part of the set do not.

Check: `ffmpeg -i publish/thumbnail.jpg -vf scale=160:-2 publish/thumbnail-160.jpg`, open it, and confirm the
subject and every word read. `ls -l publish/thumbnail.jpg` under 2,000,000 bytes; if not, lower the quality
(`-q:v 5`).

## Settings (`settings.md`)

Write one line per field, with the value and a reason where one is needed.

| Field | Value |
|---|---|
| Visibility | Unlisted first. Public only after the checks at the end of this list |
| Audience | "No, it's not made for kids", unless the profile says otherwise |
| Altered or synthetic content | the answer reasoned below |
| Category, language | from the profile; the film's on-screen language |
| Playlist | one playlist per content line; name the one this film belongs to |
| End screen | only if the film's ending has room for it (below) |
| Premiere | no, on a channel without subscribers: nobody is there to wait for it |
| File to upload | the master of the format (regular video: the `youtube` export in `out/export/`; Short: `out/film-9x16.export/film-9x16-youtube.mp4`) |
| Thumbnail | `thumbnail.jpg` (regular video) or `thumbnail-short.jpg` (Short, Studio on a computer) |
| Chapters | in the description; check that the platform shows them after upload. None for a Short |

### The AI-content question

The upload form asks whether the video contains realistic altered or synthetic content: something a viewer could
take for a real person, a real event or place, or a realistic-looking scene, or music as the main focus that was
made with AI (checked 27 November 2026). Reason it out for this film, and write the reasoning into `settings.md`:

- Could a viewer take any shot for a recording of something real that did not happen that way? A stylised or
  clearly animated film is a "No". Photographed puppets and models on a real set are a "No" too.
- A film made with `handmade.md` so that it reads as photographed models is the doubtful case, not the clear "No": the set
  does not exist, and a viewer who takes it for stop motion takes a synthetic scene for a recording. Say that in the
  reasoning, recommend "Yes" unless the film is plainly animated at a glance, and state in the description that nothing was
  photographed.
- Does any shot show a real, identifiable person, or a real place or event made to look real? Then "Yes".
- Is generated music the main focus? Generated background sound under a picture is not.
- Whatever the answer, the description says how the film was made (line 2 above).
- If you are unsure, say so and recommend "Yes": it adds a label, and a wrong "No" is the worse error.

The owner makes the declaration; you give him the answer you recommend and why.

### End screen

A Short gets none here (not checked on YouTube's pages; do not promise one). For a regular video, an end-screen element shows for at least 5 s within the last 5 to 20 s of the video (checked 27 November 2026).
If the film should carry one, its ending needs a quiet area held for 5 s or more (an outro hold). If the ending is
too short or too busy, say so and recommend no end screen rather than covering the last image. A new channel has
no other video to suggest yet.

## Before it goes public

The owner does these, in this order, and you list them at the end of `settings.md`:
1. Upload as unlisted.
2. Watch the 1080p version once from start to end, with sound.
3. Check the thumbnail, the chapters in the description and on the progress bar, and the end screen if any.
4. Make it public.

## Channel settings worth filling once

For a new channel, list in `settings.md` those still empty (checked 27 November 2026): description, links,
contact email, country, keywords, audience default, upload defaults, a trailer, one playlist per content line.
Channel art: `channel-art.md`.
