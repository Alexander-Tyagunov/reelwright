/**
 * @fileoverview Element builder for HTML and SVG. It creates elements only;
 * it keeps no state.
 */

/** SVG tag names that `h` creates in the SVG namespace. */
export type SvgTag =
  | 'svg'
  | 'g'
  | 'path'
  | 'rect'
  | 'circle'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'text'
  | 'tspan'
  | 'defs'
  | 'clipPath'
  | 'linearGradient'
  | 'stop';

/** Inline style given as an object. Keys are camelCase CSS properties. */
export type StyleObject = Partial<CSSStyleDeclaration>;

/** A value for an attribute. `null`, `undefined` and `false` skip it. */
export type AttrValue = string | number | boolean | null | undefined;

/**
 * Attributes for `h`. Special keys:
 * - `class`: sets the class attribute.
 * - `style`: an object of camelCase CSS properties.
 * - `text`: sets the text content.
 * Any other key becomes an attribute.
 */
export type Attrs = Record<string, AttrValue | StyleObject>;

/** A child of `h`: a node, a string, or a list of them. Empty values skip. */
export type Child = Node | string | false | null | undefined | readonly Child[];

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set<string>([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'clipPath',
  'linearGradient',
  'stop',
]);

function setAttr(el: Element, key: string, value: AttrValue | StyleObject) {
  if (value == null || value === false) {
    return;
  }
  if (key === 'style' && typeof value === 'object') {
    Object.assign((el as HTMLElement).style, value);
  } else if (key === 'text') {
    el.textContent = String(value);
  } else if (key === 'class') {
    el.setAttribute('class', String(value));
  } else {
    el.setAttribute(key, String(value));
  }
}

function appendAll(el: Element, kids: readonly Child[]) {
  for (const kid of kids) {
    if (Array.isArray(kid)) {
      appendAll(el, kid);
    } else if (kid != null && kid !== false) {
      el.append(kid as Node | string);
    }
  }
}

/**
 * Creates an element. SVG tag names create SVG elements.
 * @param tag Tag name, for example `'div'` or `'path'`.
 * @param attrs Attributes. `style` may be an object; `text` sets the text.
 * @param kids Children: nodes, strings or lists of them.
 */
export function h(tag: SvgTag, attrs?: Attrs, ...kids: Child[]): SVGElement;
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  ...kids: Child[]
): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Attrs, ...kids: Child[]): HTMLElement;
export function h(tag: string, attrs?: Attrs, ...kids: Child[]): Element {
  const el = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    setAttr(el, key, value);
  }
  appendAll(el, kids);
  return el;
}

/**
 * Counts the lines of text an element shows, from its scroll height.
 * @param el A laid-out element.
 */
export function lineCount(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  return Math.round(el.scrollHeight / lh);
}
