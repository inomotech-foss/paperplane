// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { CHART_COLOR_PALETTES } from "@plane/constants";

/** The categorical palette for bars coloured by work item key. */
export const getKeyPalette = (resolvedTheme: string | undefined): readonly string[] =>
  CHART_COLOR_PALETTES[0]?.[resolvedTheme === "dark" ? "dark" : "light"] ?? [];

const hashIdentifier = (identifier: string) => {
  let hash = 0;
  for (let index = 0; index < identifier.length; index++) hash = (hash * 31 + identifier.charCodeAt(index)) | 0;
  return Math.abs(hash);
};

/** Palette colour for a work item key, stepping by sequence id from a per-project offset. */
export const getWorkItemKeyColor = (
  projectIdentifier: string | undefined,
  sequenceId: number | undefined,
  palette: readonly string[]
): string | undefined => {
  if (sequenceId === undefined || palette.length === 0) return undefined;
  return palette[(hashIdentifier(projectIdentifier ?? "") + Math.abs(sequenceId)) % palette.length];
};
