/**
 * @fileoverview Command-line parsing, flag readers, frame sizes and the
 * flags of `qa`.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  boolFlag,
  numberFlag,
  parseArgs,
  stringFlag,
} from '../../plugin/skills/video/scripts/core/args.ts';
import {UserError} from '../../plugin/skills/video/scripts/core/errors.ts';
import {
  assertEvenSize,
  frameSize,
  parseSize,
} from '../../plugin/skills/video/scripts/core/spec.ts';
import {readOptions} from '../../plugin/skills/video/scripts/qa/options.ts';

describe('argument parsing', () => {
  it('a word after a flag is its value and other words are positional', () => {
    const a = parseArgs(['film.json', '--size', '1080x1920', 'extra']);
    assert.deepEqual(a.positional, ['film.json', 'extra']);
    assert.equal(a.flags.size, '1080x1920');
  });

  it('--x=v sets x to v, also when v contains an equals sign', () => {
    const a = parseArgs(['--size=1080x1350', '--note=a=b']);
    assert.equal(a.flags.size, '1080x1350');
    assert.equal(a.flags.note, 'a=b');
  });

  it('--no-x turns x off', () => {
    const a = parseArgs(['--no-poster']);
    assert.equal(a.flags.poster, false);
    assert.equal(boolFlag(a, 'poster'), false);
  });

  it('a flag followed by another flag is on', () => {
    const a = parseArgs(['--strict', '--json']);
    assert.equal(boolFlag(a, 'strict'), true);
    assert.equal(boolFlag(a, 'json'), true);
  });

  it('a flag that needs a value and has none says what to type', () => {
    assert.throws(
      () => stringFlag(parseArgs(['--video']), 'video'),
      (e: unknown) =>
        e instanceof UserError && /--video needs a value/.test(e.message),
    );
  });

  it('a number flag that is not a number names the flag and the value', () => {
    assert.throws(
      () =>
        numberFlag(parseArgs(['--fps', 'fast']), 'fps', 'frames per second'),
      /--fps must be frames per second, got "fast"/,
    );
    assert.equal(numberFlag(parseArgs(['--fps', '24']), 'fps'), 24);
  });

  it('a flag named like an object method is plain data', () => {
    const a = parseArgs(['--constructor', 'x']);
    assert.equal(a.flags.constructor, 'x');
    assert.equal(boolFlag(parseArgs([]), 'toString'), false);
  });
});

describe('frame sizes', () => {
  it('1080x1920 is read as width and height', () => {
    assert.deepEqual(parseSize('1080x1920'), {width: 1080, height: 1920});
  });

  it('an odd width or height is rejected because H.264 needs even sizes', () => {
    assert.throws(() => frameSize({scenes: []}, '1081x1920'), /must be even/);
    assert.throws(() => frameSize({scenes: []}, '1080x1921'), /must be even/);
    assert.throws(
      () => assertEvenSize({width: 1920, height: 1079}),
      /1920x1079/,
    );
  });

  it('a size that is not WIDTHxHEIGHT is rejected with an example', () => {
    assert.throws(
      () => parseSize('big'),
      /must look like 1080x1920, got "big"/,
    );
  });

  it('an odd size in the spec is rejected too', () => {
    assert.throws(
      () => frameSize({scenes: [], meta: {width: 1921, height: 1080}}),
      /must be even/,
    );
  });

  it('--size wins over the spec and the default is 1920x1080', () => {
    const film = {scenes: [], meta: {width: 1280, height: 720}};
    assert.deepEqual(frameSize(film, '1080x1350'), {width: 1080, height: 1350});
    assert.deepEqual(frameSize(film), {width: 1280, height: 720});
    assert.deepEqual(frameSize({scenes: []}), {width: 1920, height: 1080});
  });
});

describe('qa flags', () => {
  it('--page-only, --strict, --size and --video are read', () => {
    const o = readOptions(
      parseArgs([
        '--page-only',
        '--strict',
        '--size',
        '1080x1350',
        '--video',
        'a.mp4',
      ]),
    );
    assert.equal(o.pageOnly, true);
    assert.equal(o.strict, true);
    assert.equal(o.size, '1080x1350');
    assert.equal(o.video, 'a.mp4');
    assert.equal(o.maxHold, 4);
  });

  it('--max-hold must be a number of seconds', () => {
    assert.throws(
      () => readOptions(parseArgs(['--max-hold', 'long'])),
      /seconds/,
    );
  });
});
