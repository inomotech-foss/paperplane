// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { z } from "zod";
import { parseClientObject } from "./parse";

export const logoPropsSchema = z.object({
  in_use: z.enum(["emoji", "icon"]),
  emoji: z.object({ value: z.string().optional(), url: z.string().optional() }).optional(),
  icon: z
    .object({
      name: z.string().optional(),
      color: z.string().optional(),
      background_color: z.string().optional(),
    })
    .optional(),
});

export type TLogoProps = z.infer<typeof logoPropsSchema>;

/** What an entity without a usable logo shows. */
export const DEFAULT_LOGO_PROPS: TLogoProps = { in_use: "emoji" };

export const parseLogoProps = (value: unknown): TLogoProps =>
  parseClientObject("logo_props", logoPropsSchema.shape, value, DEFAULT_LOGO_PROPS);
