/**
 * @fileoverview The render cache seen from the command line: an unchanged
 * film reuses every scene, an edit re-renders only what it touches.
 */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {after, describe, it} from 'node:test';
import {missingTools} from '../helpers/cli.ts';
import {render, SMALL, workspace} from '../helpers/project.ts';

const ws = workspace();
after(() => ws.dispose());

/** Scene numbers that a render printed with the given verb. */
function scenesWith(output: string, verb: 'rendered' | 'reused'): number[] {
  const pattern = new RegExp(
    `scene\\s+(\\d+)\\s+\\S+\\s+\\d+ frames ${verb}`,
    'g',
  );
  // Two workers draw scenes at once, so the lines arrive in any order.
  return [...output.matchAll(pattern)]
    .map(m => Number(m[1]))
    .sort((a, b) => a - b);
}

describe('render cache', {skip: missingTools(), timeout: 900_000}, () => {
  it('a second render reuses all scenes; editing scene 2 re-renders scenes 2 and 3 only', async () => {
    const film = {
      meta: {title: 'Cache', ...SMALL},
      scenes: [
        {type: 'title', duration: 3, title: 'Cache test'},
        {
          type: 'bullets',
          duration: 4.5,
          heading: 'Cached scene',
          items: ['One idea', 'Two ideas'],
        },
        {
          type: 'metric',
          duration: 4,
          heading: 'Time',
          items: [
            {label: 'Before', value: 20, suffix: ' s'},
            {label: 'After', value: 8, suffix: ' s'},
          ],
        },
      ],
    };
    const p = ws.project('cache', film);
    await render(p);
    const second = (await render(p)).output;
    assert.deepEqual(scenesWith(second, 'rendered'), []);
    assert.deepEqual(scenesWith(second, 'reused'), [1, 2, 3]);
    const edited = structuredClone(film);
    edited.scenes[1] = {
      ...edited.scenes[1],
      heading: 'Edited scene',
    } as (typeof film.scenes)[1];
    writeFileSync(p.spec, JSON.stringify(edited, null, 2));
    const third = (await render(p)).output;
    assert.deepEqual(scenesWith(third, 'rendered'), [2, 3]);
    assert.deepEqual(scenesWith(third, 'reused'), [1]);
  });
});
