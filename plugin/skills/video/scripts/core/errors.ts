/**
 * @fileoverview The error type for problems a user can fix.
 */

/**
 * A problem the user caused or can fix, such as a missing file or a bad
 * option. The message must say what to do next. The CLI prints it without a
 * stack trace and exits with code 1.
 */
export class UserError extends Error {
  override name = 'UserError';
}
