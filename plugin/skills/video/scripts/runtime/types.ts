/**
 * @fileoverview Types a scene author sees: the scene context, the factory
 * signature and the track options. Hover over any member in an IDE for its
 * units.
 */

import type {
  Aspect,
  FilmPageGlobals,
  FilmSpec,
  SceneSpec,
  TextMotion,
  TransitionKind,
} from '../shared/contract.ts';
import type {Attrs, h} from './dom.ts';
import type {EaseFn, EaseName, ease} from './easing.ts';
import type {FormatOptions} from './format.ts';
import type {clamp, lerp, prog} from './math.ts';
import type {SpringSpec, spring} from './spring.ts';

/** Any element a track can move: HTML or SVG. */
export type StyledElement = HTMLElement | SVGElement;

/** The brand after defaults: every colour and font is set. */
export interface ResolvedBrand {
  /** Page background, a CSS colour. */
  bg: string;
  /** Card and panel background. */
  surface: string;
  /** Main text colour. */
  ink: string;
  /** Secondary text colour. */
  muted: string;
  /** Highlight colour: kickers, rules, bars. */
  accent: string;
  /** Text colour on top of `accent`. */
  accentInk: string;
  /** Positive colour. */
  good: string;
  /** Text colour on top of `good`. */
  goodInk: string;
  /** Negative colour. */
  bad: string;
  /** Text colour on top of `bad`. */
  badInk: string;
  /** Hairline colour. */
  line: string;
  /** Stronger hairline colour. */
  lineStrong: string;
  /** Body font family. */
  font: string;
  /** Heading font family. */
  fontDisplay: string;
  /** Monospace font family. */
  fontMono: string;
  /** Card corner radius in `u`. */
  radius: number;
}

/** The film `meta` block after defaults. */
export interface ResolvedMeta {
  title: string;
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Frames per second. */
  fps: number;
  /** Safe margin in `u`. */
  safe: number;
  background: 'plain' | 'grid';
  transition: TransitionKind;
  /** Seconds two adjacent scenes overlap. */
  transitionDuration: number;
  /** Seconds of the first entrance to skip, or `undefined` for the default. */
  lead: number | undefined;
  /** Seconds of hold required per word. */
  readingRate: number;
  /** Longest still stretch the motion gate accepts, in seconds. */
  maxHold: number;
  loop: boolean;
  progress: boolean;
  watermark: string;
  /** Seed for the per-scene random generator. */
  seed: number;
}

/** Animatable properties. Untouched properties rest at their identity. */
export interface TrackProps {
  /** Opacity, 0 to 1. Identity 1. */
  opacity?: number;
  /** Horizontal offset in `u`. Identity 0. */
  x?: number;
  /** Vertical offset in `u`. Identity 0. */
  y?: number;
  /** Uniform scale factor. Identity 1. */
  scale?: number;
  /** Rotation in degrees. Identity 0. */
  rotate?: number;
}

/** Options of `ctx.track`. */
export interface TrackSpec {
  /** Start, in scene-local seconds. Default 0. */
  at?: number;
  /** Length in seconds. Default 0.6. Ignored when `spring` is set. */
  dur?: number;
  /** Values at the start. Missing values use the value before the track. */
  from?: TrackProps;
  /** Values at the end. Missing values use the identity. */
  to?: TrackProps;
  /** A curve name or a function from 0..1 to 0..1. Default `'out'`. */
  ease?: EaseName | EaseFn;
  /** When set, a spring drives the motion instead of `ease` and `dur`. */
  spring?: SpringSpec;
}

/** Options of `ctx.enter` and `ctx.stagger`. */
export interface EnterOptions {
  /** Length in seconds. Default 0.6. */
  dur?: number;
  /** Start offset below the rest position, in `u`. Default 3.2. */
  y?: number;
  /** Start offset to the right of the rest position, in `u`. Default 0. */
  x?: number;
  /** Start scale. Default 1. Do not scale images that are `<img>`. */
  scale?: number;
  /** Curve name or function. Default `'out'`. */
  ease?: EaseName | EaseFn;
}

/** Options of `ctx.pop`. */
export interface PopOptions {
  /** Start scale. Default 0.82. */
  scale?: number;
  /** Damping ratio. Default 0.8. */
  zeta?: number;
  /** Natural frequency in radians per second. Default 16. */
  omega?: number;
}

/** Options of `ctx.fit`. */
export interface FitOptions {
  /** Most lines the text may use. Default 2. */
  maxLines?: number;
  /** Smallest size as a fraction of the starting size. Default 0.55. */
  min?: number;
}

/**
 * Everything a scene factory receives. Build the DOM once, declare motion with
 * the track methods, and keep every per-frame value a pure function of time.
 */
export interface SceneContext {
  /** This scene's full-frame layer: a flex column with safe padding. */
  readonly el: HTMLDivElement;
  /** The scene entry from the spec. */
  readonly scene: SceneSpec;
  /** The whole film spec, as written in `film.json`. */
  readonly film: FilmSpec;
  /** Zero-based position of this scene in the film. */
  readonly index: number;
  /** Frame width in pixels. */
  readonly W: number;
  /** Frame height in pixels. */
  readonly H: number;
  /** One unit in pixels: 1% of the short side. */
  readonly u: number;
  /** Safe margin in pixels. */
  readonly safe: number;
  /** Frames per second. */
  readonly fps: number;
  /** Scene duration in seconds, transitions included. */
  readonly dur: number;
  /** Frame shape: `landscape`, `square` or `portrait`. */
  readonly aspect: Aspect;
  /** Resolved brand colours and fonts. */
  readonly brand: ResolvedBrand;
  /** Element builder for HTML and SVG. */
  readonly h: typeof h;
  /** Named easing curves. */
  readonly ease: typeof ease;
  /** Spring step response. */
  readonly spring: typeof spring;
  /** Limits a value to a range. */
  readonly clamp: typeof clamp;
  /** Linear interpolation. */
  readonly lerp: typeof lerp;
  /** Progress of a time window, 0 to 1. */
  readonly prog: typeof prog;
  /** Number formatting for counters. */
  readonly fmt: (v: number, options?: FormatOptions) => string;
  /** Seeded random number in [0, 1). Use it in place of `Math.random`. */
  readonly rand: () => number;
  /**
   * Creates a text element and registers it for the layout and reading-hold
   * gates. Use it for every piece of copy.
   * @param tag Tag name, for example `'h2'`.
   * @param cls Class attribute, for example `'rw-h2'`.
   * @param str The text. `null` and `undefined` give an empty string.
   * @param attrs Extra attributes for `h`.
   */
  text(tag: string, cls: string, str: unknown, attrs?: Attrs): HTMLElement;
  /**
   * Splits a text element into one span per word, for staggered reveals.
   * @returns The word spans, in reading order.
   */
  words(el: HTMLElement): HTMLElement[];
  /** Animates an element. Several tracks on one element are allowed. */
  track(el: StyledElement, spec: TrackSpec): SceneContext;
  /**
   * Standard entrance: fade in and rise.
   * @param at Start, in scene-local seconds. Default 0.
   */
  enter(el: StyledElement, at?: number, options?: EnterOptions): SceneContext;
  /**
   * Scale-in on a spring.
   * @param at Start, in scene-local seconds. Default 0.
   */
  pop(el: StyledElement, at?: number, options?: PopOptions): SceneContext;
  /**
   * Enters a list of elements one after another.
   * @param at Start of the first, in scene-local seconds.
   * @param each Seconds between starts. Default 0.08.
   * @returns Scene-local second at which the last one finishes.
   */
  stagger(
    els: readonly StyledElement[],
    at?: number,
    each?: number,
    options?: EnterOptions,
  ): number;
  /**
   * Registers a per-frame function. It must be a pure function of `t`, the
   * scene-local time in seconds. Returning a function from the factory does
   * the same.
   */
  onFrame(fn: SceneFrameFn): SceneContext;
  /**
   * Records the scene-local second at which an element is fully revealed. Use
   * it for reveals that a frame function drives, such as typing.
   */
  settle(el: HTMLElement, seconds: number): SceneContext;
  /**
   * Records how fast a text moves while it is shown, for text that follows
   * a moving picture. The holds gate then counts it as readable only while it
   * moves slower than its limit.
   */
  motion(el: HTMLElement, profile: TextMotion): SceneContext;
  /**
   * Shrinks the font size until the element fits its box and line limit.
   * Call it after the element is in the DOM.
   */
  fit(el: HTMLElement, options?: FitOptions): SceneContext;
}

/** A per-frame function. `t` is scene-local time in seconds. */
export type SceneFrameFn = (t: number) => void;

/**
 * Builds a scene. Runs once. May return a per-frame function.
 * @param ctx The scene context.
 * @param scene The scene entry from the spec (untyped fields).
 */
export type SceneFactory = (
  ctx: SceneContext,
  scene: SceneSpec,
) => SceneFrameFn | undefined;

/** The object behind the global `Reel`, used by project scene files. */
export interface ReelApi {
  /** Registers a project scene type. */
  scene(type: string, factory: SceneFactory): void;
  ease: typeof ease;
  spring: typeof spring;
  clamp: typeof clamp;
  lerp: typeof lerp;
  prog: typeof prog;
  h: typeof h;
  formatNumber: (v: number, options?: FormatOptions) => string;
  seeded: (seed: number) => () => number;
}

declare global {
  interface Window extends Partial<FilmPageGlobals> {
    /** Helpers and scene registration for project scene files. */
    // biome-ignore lint/style/useNamingConvention: the global is named `Reel`
    Reel: ReelApi;
  }
}
