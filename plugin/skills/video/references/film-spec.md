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
| `sound` | false | Generated background sound. `true` or an object turns it on; see "sound" below. |

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
`reel scenes` prints every type with its fields; `scenes.md` holds the same output. A scene may also carry an `id`, a name that reports use, and a `chapter`, the title of the video chapter that starts with it
(`reel chapters film.json` prints the chapter list; a `chapter` changes no pixel, so editing it re-renders nothing).

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
      "side": "auto", "offset": 5, "smooth": 0.6, "follow": "both", "leader": true, "variant": "tag" }
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
- `smooth` (seconds, 0 to 5, default 0.6) lets the label glide: the box follows a low-passed copy of the track (a
  zero-phase Gaussian whose standard deviation is `smooth` seconds, computed over the frames where the point is visible,
  with no lag at the ends), while the dot and the end of the leader stay on the exact point. `0` follows the point
  exactly. `follow` is `"both"` (default), `"x"` (the box keeps one height for its whole time on screen: just clear of
  the point's highest moment while the label shows, plus `offset`, so a hop never reaches it; with `side` `bottom` it
  clears the lowest moment, with `left` or `right` it is centred on the highest) or `"none"` (the box stays where the
  point is at `from`; the leader stretches). The reading-time speed in the holds gate is the real speed of the box after
  smoothing and clamping, so a bobbing point under the default `smooth` passes and the same label with `smooth: 0` fails.
- `from` and `to` of a label or text are seconds, or `{ "event": "split", "plus": 0.3 }` for 0.3 s after an event.
- `texts` are free overlays at fixed places: `x` and `y` in u from the top left, or `"center"`; `class` is a type class
  (`rw-kicker`, `rw-h2`, `rw-body`, ...; default `rw-body`); `align` says which edge of the text `x` names.
- `cues` are sound cues in scene seconds, as on any scene (see "sound" below). They play only when `meta.sound` is on and change no pixel.
- Check a plate before using it: `reel plate plates/shot03/tracks.json` lists the tracks (share of frames visible) and events
  and verifies every frame file and the size of the first frame, then lists runs of frames that are much darker or lighter than
  the frames around them (a render that lost its foreground; exit 1). `reel build` cannot bundle a plate into one HTML file; use
  `render`. Editing `tracks.json` or any frame file re-renders that plate scene (and the scene after it, which shows the end
  of the plate during the transition) and no other.

## sound

Generated sound design, not composed music: a quiet bed under the film and short cues timed to the picture,
all computed in the engine (no samples, no network) and identical for the same spec. `meta.sound` is:

- `false` or absent: a silent film, as before.
- `true`: palette `calm`, with bed and cues.
- an object, every field optional:

| Field | Default | Meaning |
|---|---|---|
| `palette` | `"calm"` | `calm`, `bright`, `tense`, `minimal`, `epic` or `storybook`. An unknown name is refused and the palettes are listed. |
| `bed` | true | Play the pad and pulse under the film. |
| `cues` | true | Play cues timed to the picture. At least one of `bed` and `cues` must be on. |
| `auto` | true | Cues derived from the picture. `false`: none, and a scene's own `cues` still play. An object `{ "transition", "text", "ending" }` sets the whoosh at each scene change, the tick where text settles and the last-scene chime: each `true` (as planned), `false` (none) or 0 to 1 (multiplies its gain); a missing key is `true`, an unknown key is refused. |
| `volume` | 1 | 0 to 1, scales the finished track below -14 LUFS. |
| `seed` | 0 | Whole number. Same spec and seed give the same sound byte for byte. |
| `key` | the palette's | Root note: `C`, `F#`, `Bb`. |
| `tempo` | the palette's | Beats per minute, 30 to 200. Sets how often chords change and how fast a pulse plays. |
| `intensity` | 0.75 | 0 to 1, or points `[{ "at": 0, "value": 0.2 }, { "at": 30, "value": 1 }]` in film seconds, linear between points. Scales the density and level of the bed (and, a little, the cues). |

Palettes: `calm` warm major pad and soft bells; `bright` open major chords with a light plucked pulse; `tense` dark minor
drone with a slow low heartbeat; `minimal` one quiet drone and pure sine cues; `epic` minor key, low drone, driving
ostinato, heavy impacts; `storybook` gentle major music box over a soft pad. Choose the one that fits the tone of the
film. A palette sets scale, chord progression, tempo, timbre and the sound of every cue.

The bed fades in over 0.15 s, keeps under the text, and ends on a resolved chord that dies away at the film's last
frame. Cues, with pitches taken from the palette's scale:

- derived from the film: a soft whoosh centred on each scene change; a quiet pitched tick where a text block settles (at
  most one per 0.18 s, quieter for longer text, none for counting numbers); a resolving chime at the start of the last scene.
- explicit, on any scene (a `plate` scene too): `"cues": [ { "at": 1.5, "kind": "hit", "gain": 0.8 } ]`. `at` is in
  scene seconds (0 to the scene's `duration`); `kind` is `tick`, `pop`, `whoosh`, `rise`, `chime`, `hit`, `boom` or
  `sting`; `gain` is 0 to 1 (default 1); `duration` (seconds, default 2) is only for `rise`, which builds up and ends at
  `at + duration`. Explicit cues are always played.

A film with hard cuts or its own cue sheet turns the derived cues down with `auto`:
`"sound": { "auto": { "transition": 0.35, "ending": false } }` plays the whooshes at 35% and drops the chime.

`reel sound film.json` writes `out/sound.wav` (48 kHz, 16-bit, stereo) and `out/sound.json` (the cue list with times
and pitches) and prints the length, cue count, integrated loudness and true peak. `--palette name` tries another
palette without editing the spec, and works even when `meta.sound` is off. `reel render` adds the sound to the
MP4 (AAC, the video is copied, not re-encoded); `--no-sound` renders silent. The track is set to -14 LUFS with a true
peak at or below -1.5 dBTP in `sound.wav` (and, after the AAC encode, at or below -1 dBTP in the MP4).
Changing only `meta.sound` or a scene's `cues` does not redraw any scene: render again and only the sound is rebuilt
and attached. `reel export` keeps the film's own sound; `--audio file` replaces it; a GIF has
none. The `audio` gate fails when `meta.sound` is on and the video has no audio track, or when audio and video differ in
length by more than 0.1 s.

To add sound to a film that is already rendered, set `"sound": true` (or an object) in `meta` and run `reel render` again.

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
  out/              stills/, contact.jpg, strip/, strip.jpg, film.mp4, render.json, film.html, qa-report.json, sound.wav, sound.json, export/, .segments/
```

## Output names

Every output carries the name of the spec that made it, so two specs in one folder never touch each other's files.
`film.json` keeps the short names. Any other spec puts its base name first:

| Output | `film.json` | `film-desk.json` |
|---|---|---|
| video | `out/film.mp4` | `out/film-desk.mp4` |
| render summary | `out/render.json` | `out/film-desk.render.json` |
| QA report | `out/qa-report.json` | `out/film-desk.qa-report.json` |
| sound | `out/sound.wav`, `out/sound.json` | `out/film-desk.sound.wav`, `out/film-desk.sound.json` |
| stills, contact sheet | `out/stills/`, `out/contact.jpg` | `out/film-desk.stills/`, `out/film-desk.contact.jpg` |
| strip | `out/strip/`, `out/strip.jpg` | `out/film-desk.strip/`, `out/film-desk.strip.jpg` |
| exports | `out/export/` | `out/film-desk.export/` |
| bundle | `out/film.html` | `out/film-desk.html` |
| scene cache | `out/.segments/` | `out/.film-desk.segments/` |

A size or draft suffix goes after the base name as before (`out/film-desk-1080x1350.mp4`,
`out/film-desk.qa-report-1080x1350.json`). `qa`, `export`, `stills`, `sound` and `build` find their files by the same
rule, and each spec has its own scene cache.

