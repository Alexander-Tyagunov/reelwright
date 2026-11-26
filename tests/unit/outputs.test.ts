/**
 * @fileoverview Output file names: a spec called film.json keeps the short
 * names, any other spec carries its own name in every output.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  outputsOf,
  summaryPathFor,
} from '../../plugin/skills/video/scripts/core/outputs.ts';

/** Every output of a spec, for one size suffix. */
function allOf(spec: string, suffix = '') {
  const o = outputsOf(`/p/${spec}`, '/p');
  return {
    video: o.video(suffix),
    summary: o.summary(suffix),
    report: o.report(suffix),
    wav: o.sound('wav', suffix),
    soundJson: o.sound('json', suffix),
    stills: o.stills('stills', suffix),
    contact: o.sheet('stills', suffix),
    strip: o.stills('strip', suffix),
    stripSheet: o.sheet('strip', suffix),
    exports: o.exports(),
    segments: o.segments(),
    html: o.html(),
  };
}

describe('output names', () => {
  it('film.json keeps exactly the names of version 0.1', () => {
    assert.deepEqual(allOf('film.json'), {
      video: '/p/out/film.mp4',
      summary: '/p/out/render.json',
      report: '/p/out/qa-report.json',
      wav: '/p/out/sound.wav',
      soundJson: '/p/out/sound.json',
      stills: '/p/out/stills',
      contact: '/p/out/contact.jpg',
      strip: '/p/out/strip',
      stripSheet: '/p/out/strip.jpg',
      exports: '/p/out/export',
      segments: '/p/out/.segments',
      html: '/p/out/film.html',
    });
  });

  it('film.json with a size keeps the size suffix after the base name', () => {
    const names = allOf('film.json', '-1080x1350');
    assert.equal(names.video, '/p/out/film-1080x1350.mp4');
    assert.equal(names.report, '/p/out/qa-report-1080x1350.json');
    assert.equal(names.contact, '/p/out/contact-1080x1350.jpg');
  });

  it('other.json writes nothing that film.json writes', () => {
    const film = Object.values(allOf('film.json'));
    const other = Object.values(allOf('other.json'));
    assert.equal(other.length, film.length);
    for (const path of other) {
      assert.ok(!film.includes(path), `${path} is shared with film.json`);
      assert.match(path, /other/);
    }
  });

  it('film-desk.json writes out/film-desk.mp4 and out/film-desk.qa-report.json', () => {
    const names = allOf('film-desk.json');
    assert.equal(names.video, '/p/out/film-desk.mp4');
    assert.equal(names.report, '/p/out/film-desk.qa-report.json');
    assert.equal(names.summary, '/p/out/film-desk.render.json');
    assert.equal(names.wav, '/p/out/film-desk.sound.wav');
    assert.equal(names.segments, '/p/out/.film-desk.segments');
  });

  it('a draft video of another spec finds its own render summary', () => {
    assert.equal(
      summaryPathFor('/p/out/film-desk-draft.mp4', 'film-desk'),
      '/p/out/film-desk.render-draft.json',
    );
    assert.equal(
      summaryPathFor('/p/out/film-1080x1350.mp4', 'film'),
      '/p/out/render-1080x1350.json',
    );
  });

  it('a video not named after the spec has no render summary', () => {
    assert.equal(summaryPathFor('/p/out/other.mp4', 'film'), null);
  });
});
