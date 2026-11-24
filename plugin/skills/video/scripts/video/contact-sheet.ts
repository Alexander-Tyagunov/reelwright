/**
 * @fileoverview Builds one contact sheet: many frames tiled in one image.
 */
import {UserError} from '../core/errors.ts';
import {run} from '../core/process.ts';

/** Grid chosen for a contact sheet. */
export interface SheetGrid {
  cols: number;
  rows: number;
}

/** Frame size in pixels. */
interface Size {
  width: number;
  height: number;
}

/**
 * Tiles JPEG frames into one JPEG, in reading order (left to right, top to
 * bottom). Portrait films get up to 5 columns of 360 px tiles. Landscape
 * films get up to 4 columns, with tiles of 960 or 640 px. Rows are filled
 * evenly, so six frames make a 3x2 grid.
 *
 * @param frames JPEG bytes, one per tile.
 * @param out Output `.jpg` path.
 * @param size Frame size of the film, in pixels.
 * @throws UserError when ffmpeg fails.
 */
export async function makeContactSheet(
  frames: readonly Uint8Array[],
  out: string,
  size: Size,
): Promise<SheetGrid> {
  const portrait = size.height > size.width;
  const count = frames.length;
  const landscapeCols = count <= 4 ? 2 : count <= 9 ? 3 : 4;
  const maxCols = Math.min(count, portrait ? 5 : landscapeCols);
  const rows = Math.ceil(count / maxCols);
  const cols = Math.ceil(count / rows);
  const tileWidth = portrait ? 360 : cols <= 2 ? 960 : 640;
  const filter =
    `scale=${tileWidth}:-2,tile=${cols}x${rows}:padding=10:margin=10:` +
    'color=0x2b2b2b';
  const r = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-c:v',
      'mjpeg',
      '-framerate',
      '1',
      '-i',
      '-',
      '-vf',
      filter,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      out,
    ],
    {input: Buffer.concat(frames), allowFail: true},
  );
  if (r.code !== 0) {
    throw new UserError(`contact sheet failed: ${r.stderr.slice(-400)}`);
  }
  return {cols, rows};
}
