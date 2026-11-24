# Formats and delivery

Pick the size before building. A spec written with built-in scenes re-lays out at any size, so extra formats
cost one more `render --size`, but each needs its own look at the stills.

| Where it plays | Size | Shape | Notes |
|---|---|---|---|
| YouTube, docs, slides, X (wide) | 1920x1080 | 16:9 | Default. |
| X and LinkedIn feed, Instagram feed | 1080x1350 | 4:5 | Takes the most room in a phone feed. |
| Square embeds, LinkedIn | 1080x1080 | 1:1 | |
| Reels, Shorts, TikTok, Stories | 1080x1920 | 9:16 | Platform UI covers the top and bottom; raise `meta.safe` to 9 or 10. |
| Slack, chat, email | 1280x720 or 1920x1080 | 16:9 | Keep the file small; `--preset slack`. |
| README, docs page | GIF or WebM, about 960 wide | | `--preset gif` or `webm`. No sound, a few seconds. |

Rules of thumb:
- 30 fps. Use 60 only for fast, continuous motion; it doubles render time.
- Text sizes are tuned for phone viewing. If something reads small in the contact sheet, it is too small.
- One spec, several sizes: `reel stills film.json --size 1080x1920` before `reel render film.json --size 1080x1920`.

## Commands

```bash
reel render film.json                       # out/film.mp4 at the spec's size
reel render film.json --size 1080x1350      # out/film-1080x1350.mp4
reel render film.json --draft               # quarter-size, 15 fps preview for a quick look
reel export film.json --preset x --poster auto
reel export film.json --preset slack
reel export film.json --preset gif --gif-width 960
reel export film.json --preset x --audio assets/music.mp3 --fade-out 1
reel build film.json                        # out/film.html: one file that plays the film in a browser
```

`reel export --preset list` prints every preset. Exports never redraw frames; they re-mux or re-encode the master.

## Encoding

The master is H.264 High, yuv420p, BT.709 limited range with correct colour tags, `+faststart`, constant frame
rate. Brand colours survive the round trip to within about 2 levels per channel.

## Sound

Sound is optional and is added at export from a file the user supplies. The export normalises to -14 LUFS
integrated with true peak at or below -1.5 dBTP and then measures the finished file, because encoding to AAC can
raise the peak. Keep music under voice and quieter than feels natural: many viewers watch muted or at low volume.

## Poster frame

Films that animate in from nothing have an empty first frame, which becomes an empty thumbnail. `--poster auto`
writes a PNG from a settled moment of the last scene; upload it as the thumbnail or cover.
