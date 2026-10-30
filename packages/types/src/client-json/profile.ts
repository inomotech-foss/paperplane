// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { z } from "zod";
import { parseClientJson } from "./parse";

export const userThemeSchema = z.object({
  /** "light", "dark", "custom" and so on. */
  theme: z.string().optional(),
  primary: z.string().optional(),
  background: z.string().optional(),
  darkPalette: z.boolean().optional(),
});

export type IUserTheme = z.infer<typeof userThemeSchema>;

export const parseUserTheme = (value: unknown): IUserTheme => parseClientJson("theme", userThemeSchema, value, {});
