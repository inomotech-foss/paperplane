// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { I_THEME_OPTION } from "@plane/constants";
import { THEME_OPTIONS } from "@plane/constants";

/** The saved theme, or the one in use when the profile has none saved. */
export const getThemeOption = (
  savedTheme: string | undefined,
  activeTheme: string | undefined
): I_THEME_OPTION | null => THEME_OPTIONS.find((option) => option.value === (savedTheme || activeTheme)) ?? null;
