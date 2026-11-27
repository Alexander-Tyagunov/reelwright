/**
 * @fileoverview The `plate` scene through the real pipeline: the picture is
 * the plate, labels follow the tracked point, the gates accept a clean film
 * and catch a missing frame, a bright picture behind light text and a label
 * that moves too fast, and an edited plate re-renders only its own scene.
 */
import assert from 'node:assert/strict';
import {cpSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {after, before, describe, it} from 'node:test';
import {
  drawAt,
  openFilm,
} from '../../plugin/skills/video/scripts/browser/film.ts';
import type {LayoutReport} from '../../plugin/skills/video/scripts/shared/contract.ts';
import {missingTools, reel} from '../helpers/cli.ts';
import {
  greyPixels,
  meanDifference,
  PLATE_FPS,
  spread,
  tracksJson,
  writePlate,
} from '../helpers/plate.ts';
import type {Project} from '../helpers/project.ts';
import {
  detail,
  gateOf,
  qa,
  render,
  SMALL,
  workspace,
} from '../helpers/project.ts';

const ws = workspace();
const skip = missingTools();
const TRACKS = 'plates/shot01/tracks.json';

before(() => {
  if (!skip) {
    writePlate(join(ws.root, '_src'));
    writePlate(join(ws.root, '_src'), 'bright', true);
  }
});
after(() => ws.dispose());

/** The label of the one-plate scene, with a leader line by default. */
const LABEL = {
  track: 'box',
  text: 'Box',
  from: 0.8,
  to: 2.8,
  side: 'right',
  offset: 4,
};

/** The one plate scene every test starts from. */
function plateScene(extra: Record<string, unknown> = {}) {
  return {
    type: 'plate',
    duration: 3,
    plate: TRACKS,
    labels: [
      {track: 'box', text: 'Box', from: 0.8, to: 2.8, side: 'right', offset: 4},
    ],
    texts: [
      {text: 'March 2024', class: 'rw-body', x: 6, y: 8, from: 0.7, to: 2.8},
    ],
    ...extra,
  };
}

/** A project with the synthetic plates copied in. */
function plateProject(name: string, scenes: object[], meta: object = {}) {
  const film = {meta: {title: name, ...SMALL, lead: 0, ...meta}, scenes};
  const p = ws.project(name, film as never);
  cpSync(join(ws.root, '_src', 'plates'), join(p.dir, 'plates'), {
    recursive: true,
  });
  return p;
}

function frameFile(p: Project, n: number): string {
  return join(
    p.dir,
    'plates',
    'shot01',
    'frames',
    `${String(n).padStart(4, '0')}.jpg`,
  );
}

describe('plate scene', {skip, timeout: 900_000}, () => {
  it('output frame N shows plate frame floor(N / 2) when the plate runs at half the film rate', async () => {
    const p = plateProject('frames', [plateScene()]);
    await render(p);
    for (const k of [9, 18, 87]) {
      const n = Math.floor((k * PLATE_FPS) / 30);
      const video = greyPixels(join(p.dir, 'out', 'film.mp4'), k);
      const same = greyPixels(frameFile(p, n + 1), null);
      const other = greyPixels(frameFile(p, n < 20 ? n + 9 : n - 7), null);
      const near = meanDifference(video, same);
      assert.ok(
        near < 5,
        `frame ${k} differs from plate frame ${n} by ${near}`,
      );
      assert.ok(
        near * 2 < meanDifference(video, other),
        `frame ${k} is no closer to plate frame ${n} than to a distant one`,
      );
    }
  });

  it('the label box keeps its offset from the tracked point at four times', async () => {
    const p = plateProject('follow', [plateScene()]);
    const film = await openFilm(p.spec);
    try {
      for (const t of [1.2, 1.6, 2.0, 2.4]) {
        await drawAt(film.page, t);
        const report = (await film.page.eval(
          'window.__layoutReport()',
        )) as LayoutReport;
        const item = report.items.find(i => i.text === 'Box');
        assert.ok(item && item.opacity > 0.9, `label not shown at ${t} s`);
        const n = Math.floor(t * PLATE_FPS);
        const px = (100 + n + 30) * 2;
        const u = report.height / 100;
        const pad = 1.74 * u;
        assert.ok(
          Math.abs(item.x + item.w / 2 - (px + 4 * u + item.w / 2 + pad)) < 3,
          `x at ${t} s`,
        );
        assert.ok(Math.abs(item.y + item.h / 2 - 180 * 2) < 3, `y at ${t} s`);
      }
    } finally {
      await film.close();
    }
  });

  it('a clean plate film passes the determinism, layout and holds gates', async () => {
    const p = plateProject('clean', [plateScene()]);
    const {report} = await qa(p, ['--page-only']);
    for (const id of ['load', 'determinism', 'layout', 'holds'] as const) {
      const gate = gateOf(report, id);
      assert.equal(gate.status, 'PASS', `${id}: ${gate.details.join('; ')}`);
    }
  });

  it('two plate scenes with leader labels pass the determinism gate', async () => {
    const early = {labels: [{...LABEL, from: 0.1, to: 3, offset: 9}]};
    const p = plateProject('two-plates', [plateScene(), plateScene(early)]);
    const {report} = await qa(p, ['--page-only']);
    const gate = gateOf(report, 'determinism');
    assert.equal(gate.status, 'PASS', gate.details.join('; '));
  });

  it('a leader line of a scene that is off screen stays hidden after another scene is drawn', async () => {
    const early = {labels: [{...LABEL, from: 0.1, to: 3, offset: 9}]};
    const p = plateProject('leader-hidden', [plateScene(), plateScene(early)]);
    const film = await openFilm(p.spec);
    try {
      await drawAt(film.page, 3.2);
      await drawAt(film.page, 1.5);
      const shown = await film.page.eval(
        `[...document.querySelectorAll('.rw-layer[data-scene="1"] line')]
          .filter(l => getComputedStyle(l).visibility === 'visible').length`,
      );
      assert.equal(shown, 0, 'a leader line shows through a hidden scene');
    } finally {
      await film.close();
    }
  });

  it('stills draws the plate, not a blank background', async () => {
    const p = plateProject('stills', [plateScene()]);
    const made = await reel(p.dir, ['stills', p.spec]);
    assert.equal(made.code, 0, made.output);
    const pixels = greyPixels(
      join(p.dir, 'out', 'stills', '01-plate.jpg'),
      null,
    );
    assert.ok(
      spread(pixels) > 8,
      `the still is nearly one colour (spread ${spread(pixels)})`,
    );
  });

  it('a missing last frame fails the load gate and names the file', async () => {
    const p = plateProject('missing-last', [plateScene()]);
    rmSync(frameFile(p, 45));
    const {report, code} = await qa(p, ['--page-only']);
    const gate = gateOf(report, 'load');
    assert.equal(gate.status, 'FAIL');
    assert.match(detail(gate, /FAIL/), /plates\/shot01\/frames\/0045\.jpg/);
    assert.equal(code, 1);
  });

  it('a missing middle frame stops stills and names the file', async () => {
    const p = plateProject('missing-middle', [plateScene()]);
    rmSync(frameFile(p, 8));
    const made = await reel(p.dir, ['stills', p.spec, '--at', '0.5']);
    assert.equal(made.code, 1, made.output);
    assert.match(
      made.output,
      /plate frame file missing: plates\/shot01\/frames\/0008\.jpg/,
    );
  });

  it('a label on a point that is not in tracks.json fails the load gate and lists the tracks', async () => {
    const scene = plateScene({
      labels: [{track: 'opus', text: 'Opus', from: 1, to: 2}],
    });
    const p = plateProject('unknown-track', [scene]);
    const {report} = await qa(p, ['--page-only']);
    assert.match(
      detail(gateOf(report, 'load'), /FAIL/),
      /"opus" is not in tracks\.json\. Tracks: box/,
    );
  });

  it('light text over a bright plate fails the layout gate on the picture, not the brand colour', async () => {
    const scene = plateScene({
      plate: 'plates/bright/tracks.json',
      labels: [],
      texts: [
        {
          text: 'Hard to read here',
          class: 'rw-body',
          x: 6,
          y: 8,
          from: 0.2,
          to: 2.8,
        },
      ],
    });
    const p = plateProject('bright', [scene], {});
    const {report} = await qa(p, ['--page-only']);
    const gate = gateOf(report, 'layout');
    assert.equal(gate.status, 'FAIL');
    assert.match(detail(gate, /contrast/), /Hard to read here/);
  });

  it('a label that follows a fast point warns that it moves too fast to read', async () => {
    const p = plateProject('fast', [
      plateScene({plate: 'plates/shot01/fast.json'}),
    ]);
    writeFileSync(
      join(p.dir, 'plates', 'shot01', 'fast.json'),
      JSON.stringify(tracksJson(9)),
    );
    const {report} = await qa(p, ['--page-only']);
    const gate = gateOf(report, 'holds');
    assert.match(detail(gate, /moves faster/), /"Box"/);
  });

  it('a label on a bobbing track fails reading time with smooth 0 and passes with the default', async () => {
    const bob = tracksJson(1) as {points: {box: {y: number[]}}};
    bob.points.box.y = bob.points.box.y.map(
      (y, n) => y - 0.08 * Math.abs(Math.sin(n * 0.7)),
    );
    const holds = async (name: string, extra: object) => {
      const label = {track: 'box', text: 'Box', from: 0.8, to: 2.8, ...extra};
      const scene = plateScene({
        plate: 'plates/shot01/bob.json',
        labels: [label],
      });
      const p = plateProject(name, [scene]);
      const file = join(p.dir, 'plates', 'shot01', 'bob.json');
      writeFileSync(file, JSON.stringify(bob));
      return gateOf((await qa(p, ['--page-only'])).report, 'holds');
    };
    const exact = await holds('bob-exact', {smooth: 0});
    assert.match(detail(exact, /moves faster/), /"Box"/);
    const glide = await holds('bob-glide', {});
    assert.equal(glide.status, 'PASS', glide.details.join('; '));
  });

  it('editing tracks.json re-renders the plate scene and reuses the title scene', async () => {
    const title = {type: 'title', duration: 3, title: 'Before the shot'};
    const p = plateProject('cache', [title, plateScene()], {lead: 0.5});
    await render(p);
    const tracks = join(p.dir, TRACKS);
    const edited = JSON.parse(readFileSync(tracks, 'utf8'));
    edited.points.box.x[10] += 0.01;
    writeFileSync(tracks, JSON.stringify(edited));
    const second = (await render(p)).output;
    assert.match(second, /scene\s+2\s+plate\s+\d+ frames rendered/);
    assert.match(second, /scene\s+1\s+title\s+\d+ frames reused/);
  });

  it('plate reports a missing frame file and exits 1', async () => {
    const p = plateProject('check', [plateScene()]);
    const good = await reel(p.dir, ['plate', TRACKS]);
    assert.equal(good.code, 0, good.output);
    assert.match(good.output, /box\s+100% of frames visible/);
    rmSync(frameFile(p, 7));
    const bad = await reel(p.dir, ['plate', TRACKS]);
    assert.equal(bad.code, 1);
    assert.match(bad.output, /1 of 45 frame files are missing.*0007\.jpg/);
  });
});
