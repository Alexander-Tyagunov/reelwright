/**
 * @fileoverview The pure-Python parts of the Blender library, run with
 * python3: the plan reader, the plate folder rule and the picture checks.
 * Skipped when python3, Pillow or numpy is missing. Blender is not needed.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {describe, it} from 'node:test';

const LIB = join(
  import.meta.dirname,
  '..',
  '..',
  'plugin',
  'skills',
  'video',
  'blender',
);

function python(code: string) {
  const head = `import sys\nsys.path.insert(0, ${JSON.stringify(LIB)})\n`;
  return spawnSync('python3', ['-I', '-c', head + code], {encoding: 'utf8'});
}

const HAVE =
  spawnSync('python3', ['-I', '-c', 'import PIL, numpy']).status === 0;
const SKIP = HAVE ? false : 'skipped: python3 with Pillow and numpy is needed';

describe('the Blender library plan reader', {skip: SKIP}, () => {
  it('a shot with plate "plates/intro" is written to that folder, and the second format adds @9x16', () => {
    const r = python(
      'from reel_blender import plan as P\n' +
        'print(P.plate_folder("S1", {"plate": "plates/intro"}), ' +
        'P.plate_folder("S1", {"plate": "plates/intro"}, "@9x16"), ' +
        'P.plate_folder("S1", {}, "@9x16"), ' +
        'P.plate_folder("S1", {"plate": "plates/intro@9x16"}, "@9x16"))',
    );
    assert.equal(
      r.stdout.trim(),
      'plates/intro plates/intro@9x16 plates/S1@9x16 plates/intro@9x16',
    );
  });

  it('the id "../../x" is refused and named', () => {
    const r = python(
      'from reel_blender import plan as P\n' +
        'P.plan_shots({"sequences": [{"shots": [{"id": "../../x"}]}]})',
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /shot id '\.\.\/\.\.\/x'/);
  });
});

describe('the Blender library picture checks', {skip: SKIP}, () => {
  it('a black frame compared with a good one gives an infinite ratio, not a crash', () => {
    const r = python(
      'import numpy as np\nfrom reel_blender import checks as C\n' +
        'good = np.random.RandomState(1).randint(0, 255, (64, 64)).astype(np.uint8)\n' +
        'black = np.zeros((64, 64), np.uint8)\n' +
        'm = C.match(black, good)\nprint(m["brightness_ratio"], m["edge_ratio"], ' +
        'C.compare_sets([(black, good)])["ok"])',
    );
    assert.equal(r.stdout.trim(), 'inf inf False');
  });

  it('a box under 9 px is refused instead of returning NaN', () => {
    const r = python(
      'import numpy as np\nfrom reel_blender import checks as C\n' +
        'C.edge_energy(np.zeros((64, 64), np.uint8), (0, 0, 0.1, 0.1))',
    );
    assert.match(r.stderr, /ValueError: edge_energy needs a region/);
  });
});
