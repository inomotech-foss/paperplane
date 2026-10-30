/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";
import type { TipTapDocument, TipTapMark, TipTapNode } from "./types";

const tipTapMarkSchema: z.ZodType<TipTapMark> = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

const tipTapNodeSchema: z.ZodType<TipTapNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(tipTapNodeSchema).optional(),
    text: z.string().optional(),
    marks: z.array(tipTapMarkSchema).optional(),
  })
);

export const tipTapDocumentSchema: z.ZodType<TipTapDocument> = z.object({
  type: z.literal("doc"),
  content: z.array(tipTapNodeSchema).optional(),
});
