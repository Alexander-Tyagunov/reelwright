/**
 * @fileoverview The one sentence that says how to get Node 24 when the
 * shell's Node is older, shared by `reel` and `reel doctor`.
 */

/**
 * How to get Node 24 without touching the system's Node: a private copy
 * installed with npm. Shell state does not carry over between a coding
 * agent's calls, so the PATH change goes in front of every `reel` command.
 */
export const NODE_24_HELP =
  'To get Node 24 without changing the system Node: ' +
  '`npm install --prefix ~/tools/node24 node@24`, then put ' +
  '`~/tools/node24/node_modules/node/bin` first in PATH for every `reel` ' +
  'command (for example `PATH=~/tools/node24/node_modules/node/bin:$PATH ' +
  'node reel.ts doctor`), because a shell started for each command forgets ' +
  'an earlier export. Run `doctor` again to check.';
