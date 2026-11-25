/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Reads a cell's `colwidth` attribute: one pixel width per column the cell
 * spans, comma separated, the way the attribute renders.
 *
 * A cell without one keeps no width at all rather than a default. A table
 * whose cells carry no widths then lays out across the content width, while a
 * default width would pin every column of HTML from outside the editor
 * (imports, the API, a paste) to the same narrow fixed size. Tables made in
 * the editor are unaffected: `insertTable` writes its widths explicitly.
 */
export function parseColumnWidths(element: HTMLElement): number[] | null {
  const raw = element.getAttribute("colwidth");
  if (!raw) return null;

  const widths = raw.split(",").map((part) => Number.parseInt(part.trim(), 10));
  if (widths.some((width) => !Number.isFinite(width) || width <= 0)) return null;

  const colspan = Number.parseInt(element.getAttribute("colspan") ?? "1", 10);
  // prosemirror-tables expects one width per spanned column
  if (Number.isFinite(colspan) && colspan > 0 && widths.length !== colspan) return null;

  return widths;
}

export const columnWidthAttribute = {
  default: null,
  parseHTML: parseColumnWidths,
};
