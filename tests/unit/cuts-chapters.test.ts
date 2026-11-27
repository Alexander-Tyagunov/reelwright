/**
 * @fileoverview Cuts and chapters on the numbers of the first film: scene
 * lengths of the finished film, and brightness and loudness at its cuts.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  clock,
  makeChapters,
} from '../../plugin/skills/video/scripts/core/chapters.ts';
import {filmTimeline} from '../../plugin/skills/video/scripts/core/film-timeline.ts';
import {analyseCuts} from '../../plugin/skills/video/scripts/qa/cuts.ts';
import {
  auditCuts,
  gateCuts,
} from '../../plugin/skills/video/scripts/qa/gates/cuts.ts';
import {parseMomentary} from '../../plugin/skills/video/scripts/video/momentary.ts';

const DURATIONS = [
  2, 5.8333, 6.8333, 4, 9, 4.8333, 6.5, 6, 5.8333, 6.8333, 5.3333, 6.3333, 7, 6,
  7.5, 3.25,
];

const film = {
  meta: {transition: 'cut' as const, fps: 24, lead: 0},
  scenes: DURATIONS.map(duration => ({type: 'plate', duration})),
};

describe('chapters of the first film with no chapter titles', () => {
  const {slots} = filmTimeline(film);
  const scenes = slots.map(s => ({start: s.start}));
  const {chapters} = makeChapters(scenes, filmTimeline(film).duration);

  it('make at least three chapters, the first at 0:00', () => {
    assert.ok(chapters.length >= 3);
    assert.equal(chapters[0]?.at, 0);
  });

  it('are each at least 10 s long, the last one too', () => {
    const ends = [
      ...chapters.map(c => c.at),
      Math.round(filmTimeline(film).duration),
    ];
    for (let i = 1; i < ends.length; i++) {
      assert.ok((ends[i] ?? 0) - (ends[i - 1] ?? 0) >= 10, `chapter ${i}`);
    }
  });

  it('start at scene starts', () => {
    const starts = slots.map(s => Math.round(s.start));
    assert.ok(chapters.every(c => starts.includes(c.at)));
  });
});

describe('chapters with titles', () => {
  it('only titled scenes start chapters, and a titled scene under 10 s after one joins it', () => {
    const scenes = [
      {start: 0, chapter: 'One light'},
      {start: 8, chapter: 'Too close'},
      {start: 20},
      {start: 30, chapter: 'The road'},
    ];
    const {chapters, merged} = makeChapters(scenes, 60);
    assert.deepEqual(
      chapters.map(c => c.title),
      ['One light', 'The road'],
    );
    assert.deepEqual(merged, ['Too close']);
  });

  it('a film of 1 h 5 min 3 s writes its time as 1:05:03', () => {
    assert.equal(clock(3903), '1:05:03');
  });
});

describe('cuts of the first film', () => {
  const log =
    '[Parsed_ebur128_0 @ 0x1] t: 62.4   TARGET:-23 LUFS    M: -17.9 S: -18.2     I: -14.1 LUFS     LRA:   7.0 LU\n' +
    '[Parsed_ebur128_0 @ 0x1] t: 63.1   TARGET:-23 LUFS    M: -11.1 S: -17.0     I: -14.0 LUFS     LRA:   7.0 LU\n';

  it('reads momentary loudness from the ebur128 log', () => {
    assert.deepEqual(parseMomentary(log), [
      {t: 62.4, lufs: -17.9},
      {t: 63.1, lufs: -11.1},
    ]);
  });

  it('C3 to C4 (brightness 30.6 to 15.1, 6.8 LU louder) is flagged for both', () => {
    const means = Array.from({length: 1600}, (_, i) =>
      i < 1512 ? 30.6 : 15.1,
    );
    const cut = {scene: 11, from: 'C3', to: 'C4', at: 63};
    const [report] = analyseCuts([cut], means, 24, parseMomentary(log));
    assert.equal(report?.flags.length, 2);
    assert.equal(gateCuts(report ? [report] : []).status, 'WARN');
  });

  it('a video that cannot be read gives a warning, never a failure', async () => {
    const gate = await auditCuts(film, '/nonexistent/film.mp4');
    assert.equal(gate.status, 'WARN');
  });
});
