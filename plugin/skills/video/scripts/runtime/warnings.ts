/**
 * @fileoverview Load-time warnings: facts about the film that are not errors
 * but that a person should know, such as a plate shorter than its scene.
 * They are published in `FilmInfo.warnings`.
 */

const warnings: string[] = [];

/**
 * Records a warning. The same text is kept once.
 * @param message What is wrong and what to change.
 */
export function addWarning(message: string): void {
  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}

/** The warnings recorded so far, oldest first. */
export function allWarnings(): string[] {
  return [...warnings];
}
