/**
 * @fileoverview Range checks for the numeric options: each failure names the
 * option, the value given and the allowed range.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {UserError} from '../../plugin/skills/video/scripts/core/errors.ts';
import {frameSize} from '../../plugin/skills/video/scripts/core/spec.ts';
import {
  checkFps,
  checkPort,
  checkPositive,
} from '../../plugin/skills/video/scripts/core/validate.ts';

function failure(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof UserError, 'must be a UserError');
    return e.message;
  }
  return assert.fail('expected an error');
}

describe('frame size options', () => {
  it('--size 0x0 is refused and names the option and the range', () => {
    assert.match(
      failure(() => frameSize({scenes: []}, '0x0')),
      /--size width must be an even integer from 16 to 8192, got 0/,
    );
  });

  it('--size 2x2 is refused because it is below 16 pixels', () => {
    assert.match(
      failure(() => frameSize({scenes: []}, '2x2')),
      /--size width must be an even integer from 16 to 8192, got 2/,
    );
  });

  it('--size 100000x100000 is refused before Chrome is asked for it', () => {
    assert.match(
      failure(() => frameSize({scenes: []}, '100000x100000')),
      /from 16 to 8192, got 100000/,
    );
  });

  it('the largest allowed size is accepted', () => {
    assert.deepEqual(frameSize({scenes: []}, '8192x16'), {
      width: 8192,
      height: 16,
    });
  });
});

describe('frame rate, port and positive numbers', () => {
  it('--fps 0 and --fps 500 are refused, 30 is accepted', () => {
    assert.match(
      failure(() => checkFps('--fps', 0)),
      /--fps .* 1 to 120, got 0/,
    );
    assert.match(
      failure(() => checkFps('--fps', 500)),
      /got 500/,
    );
    assert.equal(checkFps('--fps', 30), 30);
  });

  it('--port 99999 and --port 1.5 are refused with the range', () => {
    assert.match(
      failure(() => checkPort('--port', 99999)),
      /--port must be an integer from 0 to 65535, got 99999/,
    );
    assert.match(
      failure(() => checkPort('--port', 1.5)),
      /got 1\.5/,
    );
    assert.equal(checkPort('--port', 4173), 4173);
  });

  it('--gif-fps 0 and --gif-width -4 are refused as not above zero', () => {
    assert.match(
      failure(() => checkPositive('--gif-fps', 0)),
      /--gif-fps must be a number greater than 0, got 0/,
    );
    assert.match(
      failure(() => checkPositive('--gif-width', -4)),
      /got -4/,
    );
    assert.equal(checkPositive('--gif-width', 480), 480);
  });
});
