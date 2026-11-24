/**
 * @fileoverview Builds the scene context object. It also returns the private
 * scene state (tracks, frame functions, registered texts) that the mount step
 * evaluates for every frame.
 */

import type {Aspect, FilmSpec, SceneSpec} from '../shared/contract.ts';
import {h, lineCount} from './dom.ts';
import {ease} from './easing.ts';
import {formatNumber} from './format.ts';
import {clamp, lerp, prog, round3} from './math.ts';
import {seeded} from './random.ts';
import {spring} from './spring.ts';
import type {SettleMark, TrackTable} from './tracks.ts';
import {addTrack, createTrack} from './tracks.ts';
import type {
  EnterOptions,
  PopOptions,
  ResolvedBrand,
  ResolvedMeta,
  SceneContext,
  SceneFrameFn,
  StyledElement,
} from './types.ts';

/** Private state of one scene. The mount step reads it every frame. */
export interface SceneState {
  tracks: TrackTable;
  frameFns: SceneFrameFn[];
  /** Elements made with `ctx.text`. */
  texts: HTMLElement[];
  settles: SettleMark[];
}

/** Frame geometry shared by all scenes of a film. */
export interface FrameGeometry {
  width: number;
  height: number;
  /** One unit in pixels. */
  u: number;
  aspect: Aspect;
}

/** Everything `createContext` needs. */
export interface ContextInit {
  film: FilmSpec;
  meta: ResolvedMeta;
  brand: ResolvedBrand;
  geometry: FrameGeometry;
  scene: SceneSpec;
  index: number;
  /** The scene's layer element. */
  layer: HTMLDivElement;
}

const SEED_STEP = 7919;
const FIT_STEPS = 40;
const FIT_SHRINK = 0.96;

function splitWords(el: HTMLElement): HTMLElement[] {
  const parts = (el.textContent ?? '').split(/(\s+)/);
  el.textContent = '';
  const spans: HTMLElement[] = [];
  for (const part of parts) {
    if (!part) {
      continue;
    }
    if (/^\s+$/.test(part)) {
      el.append(document.createTextNode(' '));
    } else {
      const span = h('span', {class: 'rw-w', text: part});
      el.append(span);
      spans.push(span);
    }
  }
  return spans;
}

function fitText(el: HTMLElement, maxLines: number, min: number): void {
  const base = parseFloat(getComputedStyle(el).fontSize);
  let size = base;
  for (let i = 0; i < FIT_STEPS && size > base * min; i++) {
    if (el.scrollWidth <= el.clientWidth + 1 && lineCount(el) <= maxLines) {
      break;
    }
    size *= FIT_SHRINK;
    el.style.fontSize = `${round3(size)}px`;
  }
}

/** The members of the context that change the scene state. */
type Methods = Pick<
  SceneContext,
  | 'text'
  | 'words'
  | 'track'
  | 'enter'
  | 'pop'
  | 'stagger'
  | 'onFrame'
  | 'settle'
  | 'fit'
>;

/** The methods that make or measure text. */
function textMethods(state: SceneState, self: () => SceneContext) {
  return {
    text(tag, cls, str, attrs) {
      const el = h(tag, {class: cls, ...attrs});
      el.textContent = str == null ? '' : String(str);
      el.dataset.rwText = '1';
      state.texts.push(el);
      return el;
    },
    words: splitWords,
    fit(el, {maxLines = 2, min = 0.55} = {}) {
      fitText(el, maxLines, min);
      return self();
    },
  } satisfies Partial<Methods>;
}

/** The methods that add motion to an element. */
function motionMethods(state: SceneState, self: () => SceneContext) {
  return {
    track(el, spec) {
      addTrack(state.tracks, el, createTrack(spec));
      return self();
    },
    enter(el, at = 0, o: EnterOptions = {}) {
      return self().track(el, {
        at,
        dur: o.dur ?? 0.6,
        from: {
          opacity: 0,
          y: o.y ?? 3.2,
          x: o.x ?? 0,
          scale: o.scale ?? 1,
        },
        ease: o.ease || 'out',
      });
    },
    pop(el: StyledElement, at = 0, o: PopOptions = {}) {
      return self().track(el, {
        at,
        from: {opacity: 0, scale: o.scale ?? 0.82},
        spring: {zeta: o.zeta ?? 0.8, omega: o.omega ?? 16},
      });
    },
    stagger(els, at = 0, each = 0.08, o: EnterOptions = {}) {
      els.forEach((el, i) => {
        self().enter(el, at + i * each, o);
      });
      const last = Math.max(0, els.length - 1) * each;
      return at + last + (o.dur ?? 0.6);
    },
  } satisfies Partial<Methods>;
}

/** Builds the methods. `self` gives the context they return for chaining. */
function createMethods(state: SceneState, self: () => SceneContext): Methods {
  return {
    ...textMethods(state, self),
    ...motionMethods(state, self),
    onFrame(fn) {
      state.frameFns.push(fn);
      return self();
    },
    settle(el, seconds) {
      state.settles.push({el, at: seconds});
      return self();
    },
  };
}

/**
 * Creates the context of one scene.
 * @param init Film, scene, brand, geometry and the scene layer.
 * @returns The public `ctx` for the factory and the private state.
 */
export function createContext(init: ContextInit): {
  ctx: SceneContext;
  state: SceneState;
} {
  const {film, meta, brand, geometry, scene, index, layer} = init;
  const {width, height, u, aspect} = geometry;
  const state: SceneState = {
    tracks: new Map(),
    frameFns: [],
    texts: [],
    settles: [],
  };
  const ctx: SceneContext = {
    el: layer,
    scene,
    film,
    index,
    // biome-ignore lint/style/useNamingConvention: documented scene API name
    W: width,
    // biome-ignore lint/style/useNamingConvention: documented scene API name
    H: height,
    u,
    safe: meta.safe * u,
    fps: meta.fps,
    dur: scene.duration,
    aspect,
    brand,
    h,
    ease,
    spring,
    clamp,
    lerp,
    prog,
    fmt: formatNumber,
    rand: seeded(1000 + index * SEED_STEP + meta.seed),
    ...createMethods(state, () => ctx),
  };
  return {ctx, state};
}
