/**
 * @fileoverview Every number the quality gates compare against. Each constant
 * names its unit. Changing one changes what the gates accept, so the matching
 * seeded-defect scenario in `tests/e2e` changes in the same commit.
 */

/**
 * Mean absolute difference, in grey levels (0 to 255), between two
 * consecutive 160x90 frames below which a frame counts as unchanged. A static
 * scene encodes to 0.000 except for a periodic keyframe refresh of about
 * 0.00x. The slowest deliberate motion, a 6 s progress bar, is above 0.05.
 */
export const FREEZE_DIFF = 0.03;

/**
 * Grey levels. A single frame below this value that sits between two
 * unchanged frames is a keyframe spike and does not split a still stretch.
 */
export const FREEZE_BRIDGE_DIFF = 0.1;

/** Seconds. A still stretch shorter than this is not reported. */
export const FREEZE_MIN_S = 0.5;

/** Grey levels. A scene must exceed this difference in its first window. */
export const DEAD_DIFF = 0.1;

/** Seconds at the start of a scene in which it must show motion. */
export const DEAD_WINDOW_S = 1.5;

/** Fraction of the film (0 to 1) that may be still before a warning. */
export const FROZEN_RATIO_WARN = 0.85;

/** Grey levels. A larger jump away from a scene boundary is a glitch. */
export const ABRUPT_DIFF = 35;

/** Seconds around a scene boundary in which a large jump is expected. */
export const BOUNDARY_S = 0.15;

/** Multiplier of the median motion in the loop seam limit. Unitless. */
export const SEAM_FACTOR = 1.5;

/** Grey levels added to the loop seam limit. */
export const SEAM_ADD = 0.05;

/** Pixels. Text may leave the safe area by this much without a finding. */
export const SAFE_TOLERANCE_PX = 1;

/** Fraction (0 to 1) of the smaller box that two texts may share. */
export const OVERLAP_FRACTION = 0.04;

/** Smallest font size as a fraction of the short side of the frame. */
export const MIN_FONT_FRACTION = 0.026;

/** Contrast ratio (WCAG, `n`:1) below which text fails. */
export const CONTRAST_FAIL = 3;

/** Contrast ratio (WCAG, `n`:1) below which text warns. */
export const CONTRAST_WARN = 4.5;

/** Seconds. A scene shorter than this triggers a pacing warning. */
export const SCENE_MIN_S = 1.5;

/** Seconds. A scene longer than this triggers a pacing warning. */
export const SCENE_MAX_S = 12;

/**
 * Levels (0 to 255) by which two renderings of one pixel may differ before
 * the pixel counts. Anti-aliasing noise stays below this.
 */
export const DETERMINISM_LEVELS = 8;

/** Pixels that may differ by more than {@link DETERMINISM_LEVELS}. */
export const DETERMINISM_PIXELS = 40;

/** Most frames the determinism gate draws. */
export const DETERMINISM_MAX_TIMES = 6;

/** Seconds added to a reading hold to allow a still scene. */
export const HOLD_MARGIN_S = 1.5;

/** Hold divided by need (0 to 1) below which the holds gate fails. */
export const HOLD_FAIL_RATIO = 0.7;

/** Standard deviation of a 64x36 grey thumbnail below which it is blank. */
export const BLANK_STDDEV = 2;

/** LUFS. Lowest accepted integrated loudness. */
export const LUFS_MIN = -16;

/** LUFS. Highest accepted integrated loudness. */
export const LUFS_MAX = -12;

/** dBTP. Highest accepted true peak. */
export const TRUE_PEAK_MAX = -1;

/** Seconds after a text settles at which the layout gate samples it. */
export const SETTLE_SAMPLE_OFFSET_S = 0.05;

/** Most moments the layout gate draws for one scene. */
export const MAX_SAMPLES_PER_SCENE = 6;

/** Pixels. Width of the grey frames the motion gate compares. */
export const MOTION_WIDTH = 160;

/** Pixels. Height of the grey frames the motion gate compares. */
export const MOTION_HEIGHT = 90;

/** Seconds. Longest still stretch accepted when the spec sets none. */
export const DEFAULT_MAX_HOLD_S = 4;

/** Seconds of film that one sparkline character stands for. */
export const SPARK_BIN_S = 0.5;

/**
 * Fraction of the short side per second. A label that follows a moving
 * picture counts as readable only while it moves slower than this.
 */
export const LABEL_MAX_SPEED = 0.06;

/**
 * Fraction (0 to 1) of a moving label's shown time above which the holds
 * gate warns when the label is faster than {@link LABEL_MAX_SPEED}.
 */
export const LABEL_FAST_SHARE = 0.5;

/** Seconds. Longest difference between audio and video length that passes. */
export const AUDIO_SYNC_MAX_S = 0.1;

/**
 * Fraction (0 to 1) of the nearer neighbour's brightness by which a run of
 * plate frames must lie outside the range of its two neighbours to be
 * reported by `reel plate`.
 */
export const PLATE_BRIGHTNESS_STEP = 0.2;

/** Grey levels (0 to 255). Smaller brightness differences are never reported. */
export const PLATE_BRIGHTNESS_FLOOR = 4;

/** Frames. Longest run of odd frames `reel plate` reports. */
export const PLATE_RUN_MAX = 12;

/**
 * Fraction (0 to 1) by which the brightness of the frames before and after a
 * run may differ for the run to count as a dropout. A larger difference is a
 * step to a new level, such as a lamp switched off.
 */
export const PLATE_ANCHOR_SPREAD = 0.35;

/**
 * Fraction (0 to 1) of the brighter frame by which the mean brightness of the
 * frames on both sides of a cut may differ before `reel cuts` flags the cut.
 */
export const CUT_BRIGHTNESS_JUMP = 0.5;

/** LU. A rise in momentary loudness across a cut above this is flagged. */
export const CUT_LOUDNESS_JUMP_LU = 6;

/** Seconds before a cut over which the loudness before it is averaged. */
export const CUT_LOUDNESS_BEFORE_S = 1;

/** Seconds just before a cut that are left out of that average. */
export const CUT_LOUDNESS_GAP_S = 0.2;

/** Seconds after a cut in which the highest loudness is taken. */
export const CUT_LOUDNESS_AFTER_S = 1;
