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
| `plate` | A pre-rendered image sequence (from Blender, say) with labels that follow tracked points. See below. |
| `quote` | A large quotation with attribution. |
| `outro` | Closing card: title, call to action, URL, logo. |

## plates

A `plate` scene plays an image sequence that was rendered elsewhere, for example in Blender, as the picture. Labels
drawn by the engine follow points that were exported with it, so the words stay on the objects while the camera
moves. A plate is a folder in the film project; keep it at the project root, for example `plates/shot03/`:

```
plates/shot03/
  tracks.json
  frames/0001.jpg ... 0270.jpg
```

```json
{
  "version": 1, "fps": 30, "frames": 270, "width": 1920, "height": 1080,
  "frame_pattern": "frames/%04d.jpg", "first": 1,
  "points": { "opus": { "x": [0.412, 0.413], "y": [0.551, 0.550], "visible": [1, 1], "depth": [8.2, 8.2] } },
  "events": [ { "name": "split", "frame": 120 } ]
}
```

| Field | Meaning |
|---|---|
| `version` | 1. Any other value is refused. |
| `fps`, `frames`, `width`, `height` | Rate of the sequence, number of frames, frame size in px. |
| `frame_pattern` | File name of a frame, relative to `tracks.json`, with one printf index such as `%04d`. |
| `first` | The number in the name of the first frame file (default 1). |
| `points` | One entry per tracked point. `x` runs 0 to 1 from the left edge, `y` 0 to 1 from the top, both of the picture. Every array has exactly `frames` values. `visible` is 0 when the point is behind the camera, outside the frame or hidden. `depth` in metres is optional. |
| `events` | Named frames (counted from 0 within the plate) that a film can refer to. |

The scene:

```json
{ "type": "plate", "duration": 9, "plate": "plates/shot03/tracks.json", "start": 0, "fit": "cover",
  "labels": [
    { "track": "opus", "text": "Opus", "sub": "most capable", "from": 3.2, "to": 8.5,
      "side": "auto", "offset": 5, "leader": true, "variant": "tag" }
  ],
  "texts": [ { "text": "March 2024", "class": "rw-kicker", "x": 6, "y": 8, "from": 0.4, "to": 8.6, "align": "left" } ],
  "cues": [] }
```

- Frame shown at scene time `t`: `floor((t + start) * plate fps)`, held at the last frame when the plate ends (the load gate
  warns). The plate rate may differ from the film rate. `fit` is `cover` (default) or `contain`.
- A label sits `offset` u (default 5) from its point on `side`: `top`, `bottom`, `left`, `right`, or `auto` (the side with the
  most room inside the safe area, judged at the point's average place while the label shows). It is clamped inside the safe
  area, and the leader line (with a dot on the point) stretches to stay attached. `leader: false` draws neither. While the
  point is not `visible` the label is hidden. It fades and slides in over 0.35 s from `from` and is gone by `to`
  (default: the scene end). `variant` is `tag` (a small panel from `--surface` behind the text) or `plain` (a soft shadow
  only); colours and fonts come from the film's `brand`.
- `from` and `to` of a label or text are seconds, or `{ "event": "split", "plus": 0.3 }` for 0.3 s after an event.
- `texts` are free overlays at fixed places: `x` and `y` in u from the top left, or `"center"`; `class` is a type class
  (`rw-kicker`, `rw-h2`, `rw-body`, ...; default `rw-body`); `align` says which edge of the text `x` names.
- `cues` is reserved for sound cues and is ignored.
- Check a plate before using it: `reel plate plates/shot03/tracks.json` lists the tracks (share of frames visible) and events
  and verifies every frame file and the size of the first frame. `reel build` cannot bundle a plate into one HTML file; use
  `render`. Editing `tracks.json` or any frame file re-renders that plate scene (and the scene after it, which shows the end
  of the plate during the transition) and no other.

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
  plates/           image sequences with tracks.json, one folder per shot
  scenes/           optional project scene types (.js or .ts)
  out/              stills/, contact.jpg, strip/, strip.jpg, film.mp4, render.json, film.html, qa-report.json, export/, .segments/
```
