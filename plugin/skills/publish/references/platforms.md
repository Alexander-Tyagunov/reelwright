# Formats per platform

Numbers here were checked on the date given beside them. Platforms change their rules without notice: before
relying on a number, search the web for the platform's current help page and use what it says today. Where you
have not checked a value, say so instead of giving one. `video/` below is the video skill's `references/` folder
(`${CLAUDE_SKILL_DIR}/../video/references/` from the publish skill).

## The three kinds of video

| Kind | Shape | Size | Use |
|---|---|---|---|
| Regular video | 16:9 | 1920 x 1080 (larger is fine) | the main film; chapters, end screen, custom thumbnail |
| Vertical | 9:16 | 1080 x 1920 | short-video feeds: on YouTube, Shorts; other apps have feeds of their own |
| Square | 1:1 | 1080 x 1080 | feeds that show square posts; on YouTube a square video up to the Shorts limit is a Short |

## YouTube (checked 27 November 2026)

- A video is a Short when it is square or vertical and at most 3 minutes long. A 16:9 video of any length is a
  regular video. So a 93-second 16:9 film is a regular video; the same film framed 9:16 would be a Short.
- Chapters, a custom thumbnail and an end screen apply to the regular video. Whether Shorts show chapters or take
  an end screen was not checked; look it up before promising either.
- Custom thumbnails, videos over 15 minutes and live streams need a phone-verified account.
- The `youtube` export preset (`reel export film.json --preset youtube`) writes an H.264 and AAC MP4 at the
  render's size; it does not change the frame.

## Other vertical feeds

Short-video apps and story feeds take 9:16 at 1080 x 1920. Their length limits, safe areas (the parts covered by
buttons and captions) and cover-frame rules differ and change often; none were checked for this reference. Search
each platform's current rules before the owner posts there, and keep labels away from the bottom fifth and the
right edge of the frame until you know its safe area.

## What a vertical or square version needs

A vertical version is a framing of its own. Cropping the 16:9 plates loses the subject or the labels' room, and
labels laid out for 16:9 do not fit a 9:16 frame.

1. The plan's `formats` lists the format, for example `{"16:9": [1920, 1080], "9:16": [1080, 1920]}`, and each
   shot gives a camera for it where the 16:9 camera does not work (`video/shot-plan.md`). That is a director's
   job: framing for a tall frame is composing again, not moving the same camera.
2. The animator renders each shot again with that camera into `plates/<shot>@9x16/`. The pose count is the same,
   so the render time is the same as the original: at the first film's 18 s a pose and 12 poses a second, a
   93-second film is about 5.5 hours.
3. `reel assemble plan/shots.json --format 9:16 --out film-9x16.json`, then `reel stills`, `reel qa --page-only`,
   `reel render`, `reel qa` and `reel cuts` on that file. Labels are placed again from the new tracks.
4. A cheaper option: a vertical cut of 30 to 60 seconds from the strongest shots
   (`reel assemble ... --shots A4,C3,D3 --format 9:16`), so fewer shots need a vertical camera.
5. A thumbnail or cover for the vertical version is a 9:16 frame of its own.

## Export sizes

Chat file sharing in this app stops at 400 MB (checked 27 November 2026), and per-pixel grain makes large
files. Keep the master, and make a viewing copy for review:
`ffmpeg -i out/film.mp4 -vf scale=1280:-2 -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart out/film-720p.mp4`.
Upload the master, not the viewing copy.
