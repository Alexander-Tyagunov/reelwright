/**
 * @fileoverview Types shared by the Node side and the browser runtime.
 * They describe the film spec and the values the film page publishes.
 */

/** Layout class of a frame, derived from its width and height. */
export type Aspect = 'landscape' | 'square' | 'portrait';

/** How one scene hands over to the next. */
export type TransitionKind = 'fade' | 'slide' | 'cut';

/** Kinds of sound cue, for the scene `cues` field and `sound.json`. */
export type CueKind =
  | 'tick'
  | 'whoosh'
  | 'rise'
  | 'chime'
  | 'hit'
  | 'boom'
  | 'pop'
  | 'sting';

/** One explicit sound cue inside a scene, in the scene's own time. */
export interface SceneCue {
  /** Seconds from the start of the scene, 0 to the scene's duration. */
  at: number;
  kind: CueKind;
  /** Loudness of this cue from 0 to 1. Default 1. */
  gain?: number;
  /** Seconds a `rise` builds before it ends. Default 2. Only for `rise`. */
  duration?: number;
}

/** One point of the sound intensity curve. */
export interface IntensityPoint {
  /** Film time in seconds. */
  at: number;
  /** Bed density and level from 0 (quiet and sparse) to 1 (full). */
  value: number;
}

/** Which derived cues play, and how loud. Missing keys mean `true`. */
export interface AutoSpec {
  /** The whoosh at each scene change. */
  transition?: boolean | number;
  /** The tick where a text block settles. */
  text?: boolean | number;
  /** The chime at the start of the last scene. */
  ending?: boolean | number;
}

/** The detailed form of `meta.sound`. All fields are optional. */
export interface SoundSpec {
  /** Palette name: calm, bright, tense, minimal, epic or storybook. */
  palette?: string;
  /** Play the background pad and pulse. Default true. */
  bed?: boolean;
  /** Play cues timed to the picture. Default true. */
  cues?: boolean;
  /**
   * Cues derived from the picture. `false`: none, only a scene's own `cues`
   * play. An object sets each kind: `true` (as planned), `false` (none) or a
   * gain multiplier from 0 to 1. Default true.
   */
  auto?: boolean | AutoSpec;
  /** Level from 0 to 1 relative to -14 LUFS. Default 1. */
  volume?: number;
  /** Integer seed. The same seed gives the same sound. Default 0. */
  seed?: number;
  /** Root note of the key, such as `C`, `F#` or `Bb`. Palette default. */
  key?: string;
  /** Beats per minute from 30 to 200. Palette default. */
  tempo?: number;
  /**
   * Bed density and level from 0 to 1, or points in film time with linear
   * steps between them. Default 0.75.
   */
  intensity?: number | IntensityPoint[];
}

/** The `meta` block of a film spec. All fields are optional. */
export interface FilmMeta {
  /** Name of the film, used in reports. */
  title?: string;
  /** Frame width in pixels. Must be even. Default 1920. */
  width?: number;
  /** Frame height in pixels. Must be even. Default 1080. */
  height?: number;
  /** Frames per second. Default 30. */
  fps?: number;
  /** Safe margin in `u` (1% of the short side). Default 6. */
  safe?: number;
  /** Background treatment. Default `plain`. */
  background?: 'plain' | 'grid';
  /** Transition between scenes. Default `fade`. */
  transition?: TransitionKind;
  /** Seconds two adjacent scenes overlap. Default 0.45. */
  transitionDuration?: number;
  /** Seconds of the first entrance to skip. Default 0.5, 0 for loops. */
  lead?: number;
  /** Seconds of hold required per word. Default 0.3. */
  readingRate?: number;
  /** Longest still stretch the motion gate accepts, in seconds. Default 4. */
  maxHold?: number;
  /** When true the last scene fades out so the last frame meets the first. */
  loop?: boolean;
  /** Shows a progress bar along the bottom edge. */
  progress?: boolean;
  /** Text or an image path shown in the top right corner. */
  watermark?: string;
  /** Seed for the per-scene random generator. Default 0. */
  seed?: number;
  /**
   * Generated background sound. `false` or absent: silent. `true`: palette
   * `calm` with bed and cues. An object sets the details.
   */
  sound?: boolean | SoundSpec;
}

/** A font file that belongs to the project. */
export interface FontFile {
  family: string;
  /** Path relative to the spec's folder. */
  src: string;
  /** CSS weight or weight range, for example `"100 900"`. */
  weight?: string | number;
  style?: string;
}

/** The `brand` block: theme, colour overrides and fonts. */
export interface Brand {
  theme?: 'dark' | 'light';
  bg?: string;
  surface?: string;
  ink?: string;
  muted?: string;
  accent?: string;
  accentInk?: string;
  good?: string;
  goodInk?: string;
  bad?: string;
  badInk?: string;
  line?: string;
  lineStrong?: string;
  font?: string;
  fontDisplay?: string;
  fontMono?: string;
  fontFiles?: FontFile[];
  /** Card corner radius in `u`. Default 2.2. */
  radius?: number;
}

/** One scene of a film. Each scene type adds its own fields. */
export interface SceneSpec {
  type: string;
  /** Seconds the scene is on screen, transitions included. */
  duration: number;
  /** Optional name used in reports. */
  id?: string;
  /** Explicit sound cues for scenes whose motion the tool cannot see. */
  cues?: SceneCue[];
  /** Title of the video chapter that starts with this scene. */
  chapter?: string;
  [field: string]: unknown;
}

/** One subtitle line drawn over every scene. */
export interface Caption {
  /** Start, in seconds from the start of the film. */
  at: number;
  /** Seconds on screen. */
  dur: number;
  text: string;
}

/** The `film.json` document. */
export interface FilmSpec {
  meta?: FilmMeta;
  brand?: Brand;
  scenes: SceneSpec[];
  captions?: Caption[];
  /** Project scene files to load, relative to the spec's folder. */
  customScenes?: string[];
}

/** Timing of one scene inside the finished film, in seconds. */
export interface SceneInfo {
  index: number;
  type: string;
  id: string | null;
  start: number;
  end: number;
  duration: number;
  /** Time at which the scene has the most on screen and is at rest. */
  check: number;
}

/**
 * How fast a text moves while it can be read. A scene records it for text
 * that follows something, so the holds gate judges reading time by speed.
 */
export interface TextMotion {
  /** Scene-local second of the first sample: the text is fully shown. */
  at: number;
  /** Seconds between samples. */
  step: number;
  /**
   * Speed at each sample as a fraction of the frame's short side per second.
   * `null` while the text is hidden.
   */
  speed: Array<number | null>;
}

/** Reading-hold figures for one registered text block. */
export interface TextInfo {
  scene: number;
  type: string;
  /** First 80 characters of the text. */
  text: string;
  words: number;
  /** Scene-local second at which the text is fully revealed. */
  settle: number;
  /** Seconds the text stays readable after it has settled. */
  hold: number;
  /** Seconds a reader needs. 0 for numbers that are not read as text. */
  need: number;
  /** Present for text that moves; `hold` then counts the shown seconds. */
  motion?: TextMotion;
}

/** Published as `window.__film` when the page is ready. */
export interface FilmInfo {
  title: string;
  width: number;
  height: number;
  fps: number;
  /** Total length in seconds. */
  duration: number;
  /** Total frame count: `round(duration * fps)`. */
  frames: number;
  loop: boolean;
  aspect: Aspect;
  /** Seconds adjacent scenes overlap. */
  overlap: number;
  /** True when a progress bar or captions depend on the whole film. */
  globalOverlays: boolean;
  /** Font families that could not be loaded. */
  missingFonts: string[];
  /** Load-time warnings: not errors, but worth a change. One sentence each. */
  warnings: string[];
  readingRate: number;
  maxHold: number;
  scenes: SceneInfo[];
  texts: TextInfo[];
}

/** Geometry of one visible text block, in frame pixels. */
export interface LayoutItem {
  id: number;
  /** Id of the nearest registered ancestor, or null. */
  parent: number | null;
  /** Scene index, or -1 for overlays. */
  scene: number;
  text: string;
  /** Effective opacity from 0 to 1. */
  opacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  /** CSS colour of the text. */
  color: string;
  /** CSS colour of the nearest opaque background. */
  bg: string;
  clipped: boolean;
}

/** Returned by `window.__layoutReport()` for the current time. */
export interface LayoutReport {
  t: number;
  width: number;
  height: number;
  /** Safe margin in pixels. */
  safe: number;
  items: LayoutItem[];
}

/** Values the film page puts on `window`. */
export interface FilmPageGlobals {
  /**
   * Draws the frame for time `t`, in seconds. When a scene throws, the other
   * scenes are still drawn, then it throws an error whose message reads
   * `scene N (type) threw at t=X.XXs: message`.
   */
  renderAt(t: number): void;
  /** `true` when frames can be drawn, `'error'` when loading failed. */
  __ready?: true | 'error';
  /**
   * Resolves once every picture the last drawn frame needs is decoded, such
   * as a plate frame. Await it after `renderAt` and before a capture.
   * Resolves at once when nothing is loading, so a film without pictures to
   * load pays nothing. Rejects with a message that names the missing or
   * unreadable file.
   */
  __settle?(): Promise<void>;
  __film?: FilmInfo;
  __errors?: string[];
  __layoutReport?(): LayoutReport;
}
