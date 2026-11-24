# Scene API

A scene is a factory function. It runs once per film, builds DOM, and declares motion. The runtime then draws any
frame by evaluating that motion at a time `t`. There are two kinds of scene file:

| Kind | Where | Registers with | Listed in |
|---|---|---|---|
| Project scene | `<project>/scenes/<type>.js` or `.ts` | the global `Reel.scene(type, factory)` | `"customScenes": ["scenes/<type>.js"]` in `film.json` |
| Built-in scene | `scripts/runtime/scenes/<type>.ts` in the plugin | `registerScene(type, factory)` from `../registry.ts` | `import './<type>.ts';` in `scripts/runtime/scenes/index.ts` |

A project scene file is an ES module that the page loads before it builds the film. Paths in `customScenes` are
relative to the folder of `film.json`. A `.ts` project scene is served with its types removed by Node
(`module.stripTypeScriptTypes`), so it may use erasable syntax only: no `enum`, no `namespace`, no parameter
properties. Nothing is compiled and nothing needs installing. `reel build` includes project scenes in the single
HTML file.

## A project scene as `.js`

```js
/* timeline — dated events along a rule, revealed in order.
   { type:"timeline", duration, heading?, events:[{ when, label }] }   (2 to 5 events) */
Reel.scene('timeline', (ctx, s) => {
  const { el, h, aspect } = ctx;
  const wide = aspect === 'landscape';
  const events = (s.events ?? []).slice(0, 5);

  if (s.heading) {
    const heading = ctx.text('h2', 'rw-h2', s.heading);
    el.append(heading);
    ctx.fit(heading, { maxLines: 2 });
    ctx.enter(heading, 0.1);
  }

  const rule = h('div', { class: 'rw-rule', style: { width: '100%' } });
  const list = h('div', {
    class: wide ? 'rw-row' : 'rw-col',
    style: { alignItems: 'stretch' },
  });
  const cards = events.map((event) => {
    const when = ctx.text('div', 'rw-chip', event.when, {
      style: { alignSelf: 'flex-start' },
    });
    const label = ctx.text('div', 'rw-h3', event.label);
    const card = h('div', { class: wide ? 'rw-card rw-col rw-grow' : 'rw-card rw-col' }, when, label);
    list.append(card);
    return card;
  });
  el.append(rule, list);

  ctx.stagger(cards, 0.4, 0.3);
  return (t) => {
    const p = ctx.ease.out(ctx.prog(t, 0.2, 1.2));
    rule.style.transform = `scaleX(${p.toFixed(3)})`;
  };
});
```

## The same scene as `.ts`

Types are optional. The `import type` line is erased before the browser sees it, so its path only has to resolve
in your editor: point it at `scripts/runtime/types.ts` inside the plugin. `declare const Reel` gives the editor the
type of the global.

```ts
import type { ReelApi, SceneContext, SceneSpec } from '<plugin>/skills/video/scripts/runtime/types.ts';

declare const Reel: ReelApi;

/* timeline — dated events along a rule, revealed in order.
   { type:"timeline", duration, heading?, events:[{ when, label }] }   (2 to 5 events) */
interface TimelineSpec extends SceneSpec {
  heading?: string;
  events?: { when: string; label: string }[];
}

Reel.scene('timeline', (ctx: SceneContext, scene: SceneSpec) => {
  const s = scene as TimelineSpec;
  const { el, h, aspect } = ctx;
  const wide = aspect === 'landscape';
  const events = (s.events ?? []).slice(0, 5);

  if (s.heading) {
    const heading = ctx.text('h2', 'rw-h2', s.heading);
    el.append(heading);
    ctx.fit(heading, { maxLines: 2 });
    ctx.enter(heading, 0.1);
  }

  const rule = h('div', { class: 'rw-rule', style: { width: '100%' } });
  const list = h('div', {
    class: wide ? 'rw-row' : 'rw-col',
    style: { alignItems: 'stretch' },
  });
  const cards = events.map((event) => {
    const when = ctx.text('div', 'rw-chip', event.when, {
      style: { alignSelf: 'flex-start' },
    });
    const label = ctx.text('div', 'rw-h3', event.label);
    const card = h('div', { class: wide ? 'rw-card rw-col rw-grow' : 'rw-card rw-col' }, when, label);
    list.append(card);
    return card;
  });
  el.append(rule, list);

  ctx.stagger(cards, 0.4, 0.3);
  return (t: number) => {
    const p = ctx.ease.out(ctx.prog(t, 0.2, 1.2));
    rule.style.transform = `scaleX(${p.toFixed(3)})`;
  };
});
```

Use it in a film with `{ "type": "timeline", "duration": 6, "heading": "From idea to release", "events": [...] }`.
Both versions above were drawn with `reel stills` at 1920x1080 and 1080x1920 while this page was written.

For a built-in scene, read `scripts/runtime/scenes/title.ts` (text and a frame function) and
`scripts/runtime/scenes/metric.ts` (counters). A built-in file starts with the header block, then a `@fileoverview`,
an exported spec interface (`TitleSceneSpec`) and `registerScene('title', (ctx, scene) => {...})`. The `add-scene`
skill lists the steps.

The factory receives `ctx` and the scene entry `s` from the spec (its fields are untyped). It may return a
per-frame function `(t) => void`, where `t` is scene-local time in seconds. The header block is a comment whose first
line reads `<type> — <summary>` and whose next lines list the spec fields. `reel scenes` reads it.

## The one rule: every frame is a pure function of t

The renderer draws frames in any order, in parallel, and reuses cached scenes. So inside a scene:

- No `Date.now()`, `performance.now()`, `setTimeout`, `setInterval`, `requestAnimationFrame`.
- No `Math.random()`; use `ctx.rand()` (seeded per scene) or `Reel.seeded(seed)`.
- No CSS `transition` or `animation` (the stylesheet sets both to `none !important`), no `<video>` or GIF playback.
- No state carried from one frame to the next. A per-frame function computes everything from `t`.
- No network requests. Images and fonts come from the project folder.
- Do not animate the `scale` of an `<img>` or `<canvas>`. Chrome caches scaled bitmaps of them, so the same frame can
  come out a pixel different depending on what was drawn before. Fade and move images; to zoom one, paint it as a
  CSS `background-image` on a `<div>` (see `scripts/runtime/scenes/image.ts`).

`reel qa` draws frames cold and in sequence and fails the film if they differ.

## The scene context

| Member | What it is |
|---|---|
| `ctx.el` | The scene layer: a full-frame flex column, centred vertically, padded by the safe margin. Add the class `center` to centre horizontally. |
| `ctx.scene` | The scene entry from the spec. The factory also receives it as its second argument. |
| `ctx.film` | The whole `film.json` as written. |
| `ctx.index` | Zero-based position of the scene in the film. |
| `ctx.W`, `ctx.H` | Frame width and height in px. |
| `ctx.u` | One unit in px: 1% of the short side. |
| `ctx.safe` | Safe margin in px (`meta.safe` times `u`). |
| `ctx.fps` | Frames per second. |
| `ctx.dur` | Scene duration in seconds, transitions included. |
| `ctx.aspect` | `"landscape"`, `"square"` or `"portrait"`. A scene must lay out sensibly in all three. |
| `ctx.brand` | Resolved brand: `bg`, `surface`, `ink`, `muted`, `accent`, `accentInk`, `good`, `goodInk`, `bad`, `badInk`, `line`, `lineStrong`, `font`, `fontDisplay`, `fontMono`, `radius`. Prefer the CSS variables. |
| `ctx.h(tag, attrs, ...children)` | Element builder for HTML and SVG tags. `attrs.class` sets the class, `attrs.style` is an object of camelCase properties, `attrs.text` sets the text; other keys become attributes. |
| `ctx.ease` | Named curves: `linear`, `out`, `in`, `inOut`, `pop`. Each maps 0..1 to 0..1 (`pop` overshoots). |
| `ctx.spring(t, {zeta, omega})` | Closed-form spring: 0 at `t` = 0, 1 at rest. Defaults: `zeta` 1, `omega` 18 rad/s. |
| `ctx.clamp(x, a, b)` | Limits `x` to `a`..`b` (defaults 0 and 1). |
| `ctx.lerp(a, b, p)` | Linear interpolation. |
| `ctx.prog(t, at, dur)` | Progress of the window that starts at `at` and lasts `dur` seconds, from 0 to 1. Wrap it in an ease. |
| `ctx.fmt(n, {decimals, prefix, suffix, compact})` | Number formatting with thousands separators; `compact` gives `k`, `M`, `B`. |
| `ctx.rand()` | Seeded random number in [0, 1). The seed comes from the scene index and `meta.seed`. |
| `ctx.text(tag, class, str, attrs?)` | Creates a text element and registers it for the layout and reading-hold gates. Use it for every piece of copy. `null` and `undefined` give an empty string. |
| `ctx.words(el)` | Splits a text element into one `rw-w` span per word and returns the spans, for staggered reveals. |
| `ctx.fit(el, {maxLines, min})` | Shrinks the font size until the text fits its box and line limit. Defaults: 2 lines, down to 0.55 of the start size. Call it after the element is in the DOM. |
| `ctx.track(el, {at, dur, from, to, ease, spring})` | Animates `opacity`, `x` and `y` (in `u`), `scale`, `rotate` (degrees). Defaults: `at` 0 s, `dur` 0.6 s, `ease` `'out'`. Untouched properties rest at identity. Several tracks on one element are allowed. |
| `ctx.enter(el, at, {dur, y, x, scale, ease})` | Standard entrance: fade in and rise. Defaults: 0.6 s, rises 3.2 `u`. |
| `ctx.pop(el, at, {scale, zeta, omega})` | Scale-in on a spring. Defaults: start scale 0.82, `zeta` 0.8 (one small bounce), `omega` 16. |
| `ctx.stagger(els, at, each, opts)` | `enter` for a list, `each` seconds apart (default 0.08). Returns the second at which the last one finishes. |
| `ctx.settle(el, seconds)` | Records the scene-local second at which `el` is fully revealed, for reveals that a frame function drives (typing, a custom counter). The holds gate uses the latest of this and the end of every track on `el`, its ancestors and its descendants. |
| `ctx.onFrame(fn)` | Registers `fn(t)`. Returning a function from the factory does the same. |

`track`, `enter`, `pop`, `onFrame`, `settle` and `fit` return `ctx`, so calls chain.

## The global `Reel`

Project scene files get the helpers they need from `Reel`, before any `ctx` exists:

| Member | What it is |
|---|---|
| `Reel.scene(type, factory)` | Registers a scene type. |
| `Reel.ease`, `Reel.spring`, `Reel.clamp`, `Reel.lerp`, `Reel.prog` | The same helpers as on `ctx`. |
| `Reel.h` | The element builder. |
| `Reel.formatNumber(v, options)` | The function behind `ctx.fmt`. |
| `Reel.seeded(seed)` | Returns a random function that always gives the same sequence for the same seed. |

## Layout rules

- Size everything in `u`: `calc(var(--u) * 4)`. Never hard-code px for a 1920-wide frame.
- Use the type classes: `rw-kicker`, `rw-h1`, `rw-h2`, `rw-h3`, `rw-sub`, `rw-body`, `rw-small`, `rw-mono`.
- Add `rw-num` to a number that counts, so its digits keep one width and the number does not shake. Do not put it
  on prose: tabular figures also widen hyphens.
  Helpers: `rw-card`, `rw-chip` (add `good`, `bad` or `neutral`), `rw-row`, `rw-col`, `rw-grow`, `rw-muted`,
  `rw-accent`, `rw-rule` (an accent bar 9u wide; set `transform: scaleX(...)` to draw it).
- Colours come from CSS variables only: `--bg --surface --ink --muted --accent --accent-ink --good --good-ink --bad
  --bad-ink --line --line-strong`. A scene never hard-codes a hex value, so it follows the brand. The fonts are
  `--font`, `--font-display` and `--font-mono`; the card radius is `--radius`.
- The smallest text is `rw-small` (3u). Anything under 2.6% of the short side draws a warning from the layout
  gate; the `code` scene goes down to 2.4u on purpose.
- Measure with `offsetWidth` and `offsetHeight`, not `getBoundingClientRect`, which is scaled in the live preview.
- SVG charts: build with `ctx.h('svg', {viewBox})`, size the box in `u`, and put labels in HTML via `ctx.text` when
  you can, so the gates can see them. Register SVG `<text>` by setting `el.dataset.rwText = '1'`.
- Give the eye one thing at a time: stagger entrances 0.08 to 0.4 s apart, never everything at once.
- A value that counts up reserves its final width (`minWidth`) so the layout does not twitch. Mark it
  `el.dataset.rwNoHold = '1'` when it is a number, not a sentence to read.

## Motion numbers

| Thing | Value |
|---|---|
| Entrance | 0.55 to 0.75 s, `ease.out` = cubic-bezier(0.16, 1, 0.3, 1), rise 1.5 to 4.5 `u`. `ctx.enter` defaults to 0.6 s and 3.2 `u`. |
| Exit | Handled by the runtime between scenes (`meta.transition`, 0.45 s overlap by default). |
| Word stagger | Up to 0.08 s between words (`title` uses the smaller of 0.08 s and 0.5 s divided by the word count). |
| List rows | Start at 0.65 s, then every 0.25 to 0.9 s so each row can be read. |
| Spring damping ratio | 1.0 text and UI, 0.8 cards, chips and logos, 0.5 playful only. |
| Counter | 1.2 s, `ease.out`. |
| Reading hold | 0.3 s per word + 0.5 s after the text settles (`meta.readingRate`; the QA gate checks this). |

## Checking a scene

```bash
node ${CLAUDE_SKILL_DIR}/scripts/reel.ts stills film.json                  # one still per scene + out/contact.jpg
node ${CLAUDE_SKILL_DIR}/scripts/reel.ts stills film.json --size 1080x1920 # out/stills-1080x1920/, out/contact-1080x1920.jpg
node ${CLAUDE_SKILL_DIR}/scripts/reel.ts stills film.json --from 4 --to 6 --every 0.2   # motion strip: out/strip/, out/strip.jpg
node ${CLAUDE_SKILL_DIR}/scripts/reel.ts stills film.json --at 1.5,3       # stills at chosen seconds
node ${CLAUDE_SKILL_DIR}/scripts/reel.ts qa film.json                      # determinism, layout, holds, freezes
```

From an agent, the entry is `${CLAUDE_PLUGIN_ROOT}/skills/video/scripts/reel.ts`. A page error (a scene that
throws, a file that does not load) is printed under `page errors:` and the command exits with code 1.

Look at the contact sheet at all three aspect ratios before calling a scene done.
