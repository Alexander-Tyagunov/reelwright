/**
 * @fileoverview Plain-text table layout for command output.
 */

/**
 * Lays rows out in columns padded to the widest cell. Columns are separated
 * by two spaces and trailing spaces are removed. Missing cells print empty.
 *
 * @param rows Rows of cells. The first row sets the column count.
 * @returns One string with a line per row.
 */
export function table(
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  const first = rows[0];
  if (!first) {
    return '';
  }
  const text = rows.map(row => row.map(cell => String(cell ?? '')));
  const widths = first.map((_, i) =>
    Math.max(...text.map(row => (row[i] ?? '').length)),
  );
  return text
    .map(row =>
      row
        .map((cell, i) => cell.padEnd(widths[i] ?? 0))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}
