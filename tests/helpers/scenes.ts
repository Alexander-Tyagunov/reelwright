/**
 * @fileoverview Project scene files used by the seeded-defect films. Each is
 * TypeScript source for the global `Reel` API, written to a project's
 * `scenes/` folder. Each one has exactly one defect, or none.
 */

/** Text that never moves: opacity 1 from the first frame. */
export const STATIC = `Reel.scene('static-text', (ctx, s) => {
  ctx.el.append(ctx.text('h2', 'rw-h2', s.heading));
});
`;

/** A number that counts for the whole scene, so the film keeps moving. */
export const TICKER = `Reel.scene('ticker', (ctx, s) => {
  const head = ctx.text('h2', 'rw-h2', s.heading);
  const num = ctx.text('div', 'rw-h1', '0', {
    style: {minWidth: 'calc(var(--u) * 40)'},
  });
  num.dataset.rwNoHold = '1';
  ctx.el.append(head, num);
  ctx.enter(head, 0.1);
  ctx.enter(num, 0.3);
  return t => {
    num.textContent = ctx.fmt(s.to * ctx.prog(t, 0.3, s.duration - 0.8));
  };
});
`;

/** Defect: unseeded randomness in a frame function. */
export const RANDOM = `Reel.scene('random-scene', (ctx, s) => {
  const t = ctx.text('h2', 'rw-h2', s.heading);
  ctx.el.append(t);
  ctx.enter(t, 0.1);
  return () => {
    t.style.marginLeft = Math.random() * 60 + 'px';
  };
});
`;

/** Defect: a counter carried from one frame to the next. */
export const STATEFUL = `Reel.scene('stateful-scene', (ctx, s) => {
  const t = ctx.text('h2', 'rw-h2', s.heading);
  ctx.el.append(t);
  ctx.enter(t, 0.1);
  let position = 0;
  return () => {
    position += 1;
    t.style.marginLeft = position + 'px';
  };
});
`;

/** Defect: a heading placed half outside the frame. */
export const OFF_FRAME = `Reel.scene('offframe-scene', (ctx, s) => {
  const t = ctx.text('h2', 'rw-h2', s.heading, {
    style: {position: 'absolute', left: 'calc(var(--u) * -9)', top: '40%'},
  });
  ctx.el.append(t);
  ctx.enter(t, 0.1, {y: 0});
});
`;

/** Defect: two texts at the same place. */
export const OVERLAP = `Reel.scene('overlap-scene', (ctx, s) => {
  const pos = {
    position: 'absolute',
    left: 'calc(var(--u) * 10)',
    top: '40%',
    width: 'calc(var(--u) * 60)',
  };
  const a = ctx.text('h2', 'rw-h2', s.a, {style: pos});
  const b = ctx.text('h2', 'rw-h2', s.b, {style: pos});
  ctx.el.append(a, b);
  ctx.enter(a, 0.1, {y: 0});
  ctx.enter(b, 0.2, {y: 0});
});
`;

/** Defect: a block added to the stage that is visible on the last frame only. */
export const SEAM = `Reel.scene('seam-scene', (ctx, s) => {
  const head = ctx.text('h2', 'rw-h2', s.heading);
  ctx.el.append(head);
  ctx.enter(head, 0.1);
  const slab = ctx.h('div', {
    style: {
      position: 'absolute',
      left: '30%',
      top: '30%',
      width: '40%',
      height: '40%',
      background: 'var(--accent)',
      opacity: '0',
    },
  });
  ctx.el.parentElement.append(slab);
  return t => {
    slab.style.opacity = ctx.prog(t, 0.5, 1).toFixed(3);
  };
});
`;

/** Defect: text almost the colour of the dark theme background. */
export const LOW_CONTRAST = `Reel.scene('lowcontrast-scene', (ctx, s) => {
  const t = ctx.text('h2', 'rw-h2', s.heading, {style: {color: '#14171E'}});
  ctx.el.append(t);
  ctx.enter(t, 0.1);
});
`;

/** Defect: an off-frame label that is visible only early in the scene. */
export const MID_LABEL = `Reel.scene('mid-label', (ctx, s) => {
  const head = ctx.text('h2', 'rw-h2', s.heading);
  const label = ctx.text('div', 'rw-h2', s.label, {
    style: {position: 'absolute', left: 'calc(var(--u) * -9)', top: '60%'},
  });
  ctx.el.append(head, label);
  ctx.enter(head, 0.1);
  ctx.enter(label, 0.3, {y: 0});
  return t => {
    label.style.visibility = t > 0.4 && t < 2 ? 'visible' : 'hidden';
  };
});
`;

/** A scene written with types, to prove type stripping works for projects. */
export const TYPED = `import type {SceneContext, SceneSpec} from '/__reel/runtime/types.ts';

declare const Reel: {scene(type: string, f: (c: SceneContext, s: SceneSpec) => void): void};

interface Row {
  label: string;
  value: number;
}

function rowsOf(scene: SceneSpec): Row[] {
  return (scene.rows as Row[] | undefined) ?? [];
}

Reel.scene('typed-rows', (ctx: SceneContext, scene: SceneSpec): void => {
  const heading: HTMLElement = ctx.text('h2', 'rw-h2', scene.heading);
  ctx.el.append(heading);
  ctx.enter(heading, 0.1);
  const items = rowsOf(scene).map((row: Row, i: number) => {
    const line = ctx.text('div', 'rw-body', \`\${row.label}: \${row.value}\`);
    ctx.el.append(line);
    ctx.enter(line, 0.4 + i * 0.2);
    return line;
  });
  ctx.onFrame((t: number): void => {
    items.forEach((el, i) => {
      el.style.letterSpacing = \`\${ctx.prog(t, 0.4 + i * 0.2, 1) * 0.5}px\`;
    });
  });
});
`;
