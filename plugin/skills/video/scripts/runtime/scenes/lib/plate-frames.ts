/**
 * @fileoverview The decoded frames of a plate. The store fetches a frame
 * file, decodes it, and keeps a small number of decoded frames, so a plate of
 * thousands of frames does not exhaust memory. A frame is shown through a
 * blob address that the store owns, so painting it never triggers a second
 * request. What the store holds affects speed only, never the picture.
 */

/** Most decoded frames kept at once. */
const CACHE_FRAMES = 24;
/** Frames after the wanted one that are loaded in advance. */
const AHEAD_FRAMES = 6;

/** What {@link createFrameStore} needs. */
export interface FrameStoreInit {
  /** Address of frame `index` (zero-based), relative to the page. */
  fileOf: (index: number) => string;
  /** Number of frames in the plate. */
  count: number;
  /** Called with the blob address when the wanted frame finishes decoding. */
  onWanted: (url: string) => void;
}

/** A cache of decoded plate frames. */
export interface FrameStore {
  /**
   * Asks for a frame and starts loading the frames after it.
   * @param index Zero-based frame.
   * @returns The address to paint when the frame is decoded, otherwise
   *   `null`; `onWanted` is called when it is.
   */
  want(index: number): string | null;
  /** The decoded image of the wanted frame, or `null` while it loads. */
  current(): HTMLImageElement | null;
  /**
   * Reports what the wanted frame still waits for.
   * @returns `null` when it is decoded, otherwise a promise that resolves
   *   once it is, or rejects once with an error that names the file.
   */
  pending(): Promise<void> | null;
}

/** One decoded frame and the address that paints it. */
interface Entry {
  img: HTMLImageElement;
  url: string;
}

async function fetchFrame(file: string): Promise<Entry> {
  const res = await fetch(file);
  if (!res.ok) {
    throw new Error(
      `plate frame file missing: ${file}. Render the frame again or copy ` +
        'it into the plate folder, then run the command again.',
    );
  }
  const url = URL.createObjectURL(await res.blob());
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      `plate frame is not a readable image: ${file}. Render the frame ` +
        'again, then run the command again.',
    );
  }
  return {img, url};
}

/**
 * Creates the frame store of one plate.
 * @param init Frame addresses, frame count and the paint callback.
 */
export function createFrameStore(init: FrameStoreInit): FrameStore {
  const decoded = new Map<number, Entry>();
  const loading = new Map<number, Promise<void>>();
  const failed = new Map<number, Error>();
  let wanted = -1;

  const evict = () => {
    for (const [index, entry] of decoded) {
      if (decoded.size <= CACHE_FRAMES) {
        break;
      }
      if (index !== wanted) {
        URL.revokeObjectURL(entry.url);
        decoded.delete(index);
      }
    }
  };
  const load = (index: number) => {
    if (decoded.has(index) || loading.has(index) || failed.has(index)) {
      return;
    }
    const done = fetchFrame(init.fileOf(index))
      .then(entry => {
        decoded.set(index, entry);
        evict();
        if (index === wanted) {
          init.onWanted(entry.url);
        }
      })
      .catch((e: unknown) => {
        failed.set(index, e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => loading.delete(index));
    loading.set(index, done);
  };
  return {
    want(index) {
      wanted = index;
      const last = Math.min(index + AHEAD_FRAMES, init.count - 1);
      for (let i = index; i <= last; i++) {
        load(i);
      }
      const entry = decoded.get(index);
      if (entry) {
        decoded.delete(index);
        decoded.set(index, entry);
      }
      return entry?.url ?? null;
    },
    current: () => decoded.get(wanted)?.img ?? null,
    pending() {
      const index = wanted;
      if (index < 0 || decoded.has(index)) {
        return null;
      }
      return (loading.get(index) ?? Promise.resolve()).then(() => {
        const error = failed.get(index);
        if (error && wanted === index) {
          wanted = -1;
          throw error;
        }
      });
    },
  };
}
