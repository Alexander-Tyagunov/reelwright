# film.json

One JSON file describes a film. Paths inside it are relative to the folder that holds it.

```json
{
  "meta": { "title": "Release 2.4", "width": 1920, "height": 1080, "fps": 30 },
  "brand": { "theme": "dark", "accent": "#E8613C" },
  "scenes": [
    { "type": "title", "duration": 3.5, "kicker": "Release 2.4", "title": "Exports are three times faster" },
    { "type": "changelog", "duration": 7, "heading": "Also new", "items": [ { "tag": "new", "title": "Scheduled reports" } ] },
    { "type": "outro", "duration": 3.5, "title": "Available now", "url": "example.com/changelog" }
  ]
}
```

## meta

| Field | Default | Meaning |
|---|---|---|
| `title` | | Name of the film, used in reports. |
| `width`, `height` | 1920, 1080 | Frame size in px, even numbers. `--size WxH` on `init`, `preview`, `stills`, `render`, `build` and `export` overrides it, so one spec serves several formats. |
| `fps` | 30 | 30 unless there is a reason. 60 doubles render time and helps only fast motion. |
| `transition` | `"fade"` | Between scenes: `fade` (outgoing clears, then incoming lands), `slide`, or `cut`. |
| `transitionDuration` | 0.45 | Seconds. Adjacent scenes overlap by this much, so total length = sum of durations minus overlaps. |
| `lead` | 0.5 | Seconds of the first scene's entrance that are skipped, so the film opens already in motion and frame 0 is not empty. Total length shrinks by this much. 0 for loops. |
| `safe` | 6 | Safe margin in `u` (1% of the short side). The layout gate fails text outside it. |
| `background` | `"plain"` | `plain` or `grid` (a quiet dot grid). |
| `readingRate` | 0.3 | Seconds of hold required per word, plus 0.5 s. |
| `maxHold` | 4 | Longest stretch with no motion that the QA gate accepts, in seconds. |
| `loop` | false | Set true for a seamless loop: the last scene fades to the background so the final frame matches the first; the motion gate checks the seam. |
| `progress` | false | Thin progress bar along the bottom. |
| `watermark` | | Text or an image path shown in the top right corner. |
| `seed` | 0 | Changes the seeded randomness scenes may use. |

## brand

`theme` is `"dark"` or `"light"`. Any colour can be overridden with a hex value:
`bg`, `surface`, `ink`, `muted`, `accent`, `accentInk` (text on accent), `good`, `goodInk`, `bad`, `badInk`,
`line`, `lineStrong`. Keep `ink` on `bg` at a contrast ratio of 4.5 or more; the gate measures it.

Fonts: `font`, `fontDisplay` (headings), `fontMono`. Inter and JetBrains Mono are bundled, so films look the
same on every machine. To use a brand font, put the file in the project and declare it:

```json
"brand": { "font": "Acme Sans", "fontFiles": [ { "family": "Acme Sans", "src": "assets/fonts/AcmeSans-Variable.woff2", "weight": "100 900" } ] }
```

`radius` (default 2.2, in `u`) rounds cards.

## scenes

An array, in order. Every scene has `type` and `duration` (seconds) and the fields of its type.
`reel scenes` prints every type with its fields; `scenes.md` holds the same output. A scene may also carry an `id`, a name that reports use.

| Type | Use it for |
|---|---|
| `title` | Opening or section card: kicker, title, subtitle, logo. |
| `bullets` | A heading and up to 5 short points, revealed one at a time. |
| `changelog` | Release-note rows tagged new / improved / fixed. |
| `metric` | One to three big numbers that count up, with change chips. |
| `bar-chart` | Comparing up to 10 categories; one bar can be highlighted. |
| `line-chart` | One to three series over time, drawn on. |
| `compare` | Before and after, or A against B, as two cards. |
| `code` | A code card revealed by line or typed, with added and removed lines. |
| `flow` | Two to five steps joined by arrows, built in order. |
| `image` | A screenshot or picture with a slow zoom and callout boxes. |
| `quote` | A large quotation with attribution. |
| `outro` | Closing card: title, call to action, URL, logo. |

## captions

Optional subtitles, drawn over every scene:

```json
"captions": [ { "at": 0.4, "dur": 3.1, "text": "Exports used to take three minutes." } ]
```

## customScenes

Project scene files (`.js` or `.ts`) to load before the film is built: `"customScenes": ["scenes/timeline.js"]`.
See `scene-api.md`.

## Project folder

```
my-film/
  film.json
  content.json      facts, with sources
  storyboard.md     scene table and exact copy
  assets/           logo, screenshots, fonts, audio
  scenes/           optional project scene types (.js or .ts)
  out/              stills/, contact.jpg, strip/, strip.jpg, film.mp4, render.json, film.html, qa-report.json, export/, .segments/
```
