# Scene types

Generated from the scene files by `reel scenes --md`. Every scene also takes `type` and `duration` (seconds).

## `bar-chart`

Up to 10 bars that grow from zero with a stagger; value labels count up and end on the exact value.

```
{ type:"bar-chart", duration, heading?, data:[{ label, value, highlight?: bool }] (1 to 10 bars, value >= 0),
unit?, prefix?, suffix?, decimals?, compact?, orientation?: "horizontal"|"vertical", note? }
unit is an alias of suffix (suffix wins). Highlighted bars use the accent, the rest a muted tone; with no
highlight every bar uses the accent. orientation defaults to vertical in landscape with 8 bars or fewer, otherwise
horizontal. A vertical chart whose columns are too narrow for the value labels falls back to horizontal.
Long labels are fitted, then cut with an ellipsis.
```

## `bullets`

Heading plus up to 5 short points, revealed one at a time.

```
{ type:"bullets", duration, heading, items:[ "text" | {text, note?} ], numbered?: bool, pace?: seconds between items }
```

## `changelog`

Release-notes list: a tag chip, a title and an optional detail line per row.

```
{ type:"changelog", duration, heading?, items:[{ tag, title, detail? }] }   (1 to 6 items)
tag "new" -> accent chip, "improved" -> neutral, "fixed" -> good; any other string -> neutral (shown uppercase).
Rows reveal one at a time, paced from the scene duration like bullets. Landscape with 5 or 6 items uses two
columns (read down the left column, then the right). Titles shrink, then detail lines are cut, if the list
would not fit the frame.
```

## `code`

A code card: monospace lines revealed line by line or typed, with diff and highlight rows.

```
{ type:"code", duration, heading?, filename?,
lines:[ "text" | { text, kind?: "add"|"remove"|"dim", highlight?: bool } ]   (1 to 14 lines; extra lines are ignored)
reveal?: "lines"|"type"|"none"   (default "lines"; "type" types characters left to right, finishing 0.75 s before the end
of the scene at the latest, so a long text types fast; "none" shows all at once)
note? }                           (small line under the card)
add = green row with a "+" gutter, remove = red row with a "-" gutter, dim = faded row, highlight = accent bar that
fades in after the reveal. Lines starting with // or # are muted. Font size is fitted to the longest line (5u down
to 2.7u); below that the lines wrap.
```

## `compare`

Before/after or A-vs-B: two cards, the left enters first, then the right; items stagger in.

```
{ type:"compare", duration, heading?,
left:  { title, items:[ "text" ] (1 to 4), tone?: "bad"|"neutral" },     // default "neutral"
right: { title, items:[ "text" ] (1 to 4), tone?: "good"|"accent" } }    // default "accent"
note?: a small muted footnote under the cards (scene level), entering after the last item.
Side by side in landscape, stacked in portrait and square. Items may also be written {text}. Item text is
shrunk, then cut with an ellipsis, if the cards would not fit the frame.
```

## `flow`

Explainer diagram: 2 to 5 boxes joined by arrows, revealed in order (box, then the arrow draws to the next).

```
{ type:"flow", duration, heading?, steps:[{ title, detail? }]   (2 to 5; a plain string is a title)
active?: index of the step to emphasise once everything is on screen (accent border and fill)
note? }                                                         (small line under the diagram)
Horizontal in landscape, vertical in square and portrait.
```

## `image`

A screenshot or picture, optionally framed, with a slow zoom and accent callout boxes.

```
{ type:"image", duration, src, heading?, caption?,
fit?: "contain"|"cover"        (default "contain": the whole image is shown and the frame hugs it; "cover" fills the available area and crops)
frame?: bool                   (default true: rounded card with a border)
zoom?: number                  (default 1.04: slow scale from 1 to zoom over the scene; 1 = off)
callouts?: [{ x, y, w, h, label?, at? }] }
src is relative to the film.json folder. Callout x, y, w, h are percentages of the image as drawn (for "cover", of the
frame). Each callout draws in at `at` seconds (default 1 s, then 0.6 s apart) with an optional label chip.
```

## `line-chart`

One to three series drawn on left to right, a dot riding the line end, end value labels.

```
{ type:"line-chart", duration, heading?, series:[{ name, values:[numbers] }] (1 to 3 series, 2+ points each,
name required when there are 2+ series), labels?:[x labels] (one per point), prefix?, suffix?, decimals?,
compact?, yMin?, yMax?, note? }
Series 1 uses the accent, series 2 the ink at lower opacity, series 3 the muted colour. Three to four light
gridlines with y labels; x labels are the first, the last and a few evenly spaced ones that fit.
yMin/yMax default to a nice axis (starting at 0 when the data are non-negative and the minimum is under 60% of
the maximum). Points outside yMin/yMax are clamped to the plot edge. A legend shows only with 2+ series.
```

## `metric`

One to three big numbers that count up.

```
{ type:"metric", duration, heading?, items:[{ label, value, from?, decimals?, prefix?, suffix?, compact?, delta?, good?: bool, note? }] }
A single metric may be written flat: { type:"metric", label, value, ... }
note?: a small muted footnote under the tiles (scene level), entering after the last tile.
```

## `outro`

Closing card, centred; the last frame is a settled poster.

```
{ type:"outro", duration, title, subtitle?, cta?, url?, logo? }
cta = text of a button-shaped chip, url = shown in mono under it, logo = image path relative to the film.json folder.
```

## `plate`

A pre-rendered image sequence as the picture, with labels that follow tracked points and free texts on top.

```
{ type:"plate", duration, plate, start?, fit?, labels?, texts?, cues? }
plate: path of tracks.json relative to the film.json folder, for example "plates/shot03/tracks.json". The frames are named by its frame_pattern.
start?: seconds into the plate at which the scene begins (default 0). The frame shown at scene time t is floor((t + start) * plate fps), held at the last frame when the plate ends (a load warning says so).
fit?: "cover" (default, fills the frame and crops) | "contain" (shows the whole picture with bars).
labels?: [{ track, text, sub?, from?, to?, side?, offset?, leader?, variant? }]  up to 40
track: a point name from tracks.json. text: the label. sub: a smaller second line.
from, to: scene seconds, or { event, plus? } for a named frame of the plate (plus in seconds). Defaults: 0 and the scene end. The label is gone by `to`.
side: "top" | "bottom" | "left" | "right" | "auto" (default: the side with the most room around the point's average place while the label shows).
offset: gap between the point and the label box in u (default 5). leader: line and dot from label to point (default true).
variant: "tag" (default, small panel behind the text) | "plain" (text with a soft shadow only).
A label is hidden while its point is not visible, and is kept inside the safe area (the leader stretches).
texts?: [{ text, class?, x, y, from?, to?, align? }]  free overlays. class is a type class (default "rw-body"). x and y are u from the top left, or "center". align: "left" (default) | "center" | "right" sets which edge x names.
cues?: reserved for sound cues; ignored.
```

## `quote`

One large quotation, words staggering in, attribution last.

```
{ type:"quote", duration, quote, author?, role? }
The quote is fitted to at most 5 lines; the opening quotation mark is drawn in the accent colour.
```

## `title`

Opening or section card.

```
{ type:"title", duration, title, kicker?, subtitle?, logo?, align?: "center"|"left",
accent?: a substring of title; the words inside it are coloured with the accent (ignored if not found) }
```
