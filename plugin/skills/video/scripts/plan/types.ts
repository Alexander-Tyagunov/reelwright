/**
 * @fileoverview The shot plan as the engine reads it. Only the fields the
 * engine needs are typed; every other field of a plan, a shot or a label
 * belongs to the 3D side and is kept as it was written.
 */

/** One sound cue of a shot, placed on a pose. */
export interface PlanCue {
  /** Pose number inside the shot, counted from 1. */
  pose: number;
  /** Cue kind; one of the engine's cue kinds. */
  kind: string;
  /** Level from 0 to 1. */
  gain: number;
}

/** A named pose of a shot. */
export interface PlanEvent {
  name: string;
  /** Pose number inside the shot, counted from 1. */
  pose: number;
}

/** A label that follows a tracked point of the plate. */
export interface PlanLabel {
  /** Name of the track in the plate's `tracks.json`. */
  track: string;
  text: string;
  sub: string;
  /** Optional third line, shown at the foot of the frame. */
  line?: string;
  /** First pose on screen, counted from 1. */
  from_pose: number;
  /** Last pose on screen, counted from 1. */
  to_pose: number;
  side?: string;
  /** Distance from the point, in `u`. */
  offset?: number;
  /** Seconds of smoothing. */
  smooth?: number;
  follow?: string;
}

/** One shot: a plate of `poses` frames. */
export interface PlanShot {
  id: string;
  /** Number of poses, which equals the number of plate frames. */
  poses: number;
  /** Names of the tracks the plate exports. */
  tracks: string[];
  labels: PlanLabel[];
  cues: PlanCue[];
  events: PlanEvent[];
  /** Plate folder, relative to the film folder. Default `plates/<id>`. */
  plate?: string;
  /** Title of the video chapter that starts with this shot. */
  chapter?: string;
}

/** A group of shots. */
export interface PlanSequence {
  id: string;
  shots: PlanShot[];
}

/** One point of the intensity curve, in plan seconds. */
export interface PlanIntensityPoint {
  at_s: number;
  /** Level from 0 to 1. */
  value: number;
}

/** The sound block of a plan. */
export interface PlanSound {
  intensity: PlanIntensityPoint[];
  /** Name of an engine palette. Default `storybook`. */
  engine_palette?: string;
  /** Overrides of the derived cues, as `meta.sound.auto`. */
  auto?: Record<string, unknown>;
}

/** A validated shot plan. */
export interface ShotPlan {
  title: string;
  /** Poses per second. Default 12. */
  fps_poses: number;
  /** Frames per second of the film. Default 24. */
  film_fps: number;
  /** Frame size in pixels by format name, first format first. */
  formats: Record<string, [number, number]>;
  total_poses?: number;
  sound: PlanSound;
  sequences: PlanSequence[];
}

/** Placement fixes for one label, from `label-overrides.json`. */
export type LabelOverride = Record<string, unknown> & {
  line?: Record<string, unknown>;
};

/** Overrides by shot id, then by label text. */
export type LabelOverrides = Record<string, Record<string, LabelOverride>>;

/** A cue of a plate that is not in the plan, from `extra-cues.json`. */
export type ExtraCues = Record<string, PlanCue[]>;

/** Free text of a plate scene, as a `plate` scene's `texts` list. */
export type SceneTexts = Record<string, unknown>[];

/** The optional files beside a plan. */
export interface SideFiles {
  overrides: LabelOverrides;
  extraCues: ExtraCues;
  outroTexts: Record<string, SceneTexts>;
  /** The `brand` block, or null when there is no `brand.json`. */
  brand: Record<string, unknown> | null;
}
