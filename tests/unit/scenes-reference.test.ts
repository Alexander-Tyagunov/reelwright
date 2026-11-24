/**
 * @fileoverview The scene reference that skills read is generated from the
 * scene files. It must not drift from them.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, it} from 'node:test';
import {
  readScenes,
  sceneMarkdown,
} from '../../plugin/skills/video/scripts/commands/scenes.ts';
import {ENGINE_ROOT} from '../../plugin/skills/video/scripts/core/paths.ts';

describe('scene reference', () => {
  it('the scenes reference matches what `reel scenes --md` prints', () => {
    const file = join(ENGINE_ROOT, 'references', 'scenes.md');
    assert.equal(
      sceneMarkdown(readScenes()),
      readFileSync(file, 'utf8'),
      'references/scenes.md is out of date. Regenerate it with: ' +
        'node plugin/skills/video/scripts/reel.ts scenes --md > ' +
        'plugin/skills/video/references/scenes.md',
    );
  });
});
