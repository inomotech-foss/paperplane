/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";

// The generated `IssueComment` schema is the workspace serializer. The public one differs in `comment_reactions`.
const optionalString = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined)
  .optional();

const actorSchema = z.object({
  id: optionalString,
  display_name: optionalString,
  first_name: optionalString,
  last_name: optionalString,
  avatar_url: optionalString,
  is_bot: z.boolean().optional(),
});

const commentReactionSchema = z.object({
  id: z.string(),
  comment: z.string(),
  reaction: z.string(),
  actor_detail: actorSchema.nullable(),
});

const publicCommentSchema = z.object({
  id: z.string(),
  comment_html: z.string(),
  created_at: z.string(),
  actor_detail: actorSchema.nullable(),
  comment_reactions: z.array(commentReactionSchema),
});

export type TPublicComment = z.infer<typeof publicCommentSchema>;
export type TPublicCommentReaction = z.infer<typeof commentReactionSchema>;

export const parsePublicComment = (data: unknown): TPublicComment => publicCommentSchema.parse(data);

/** Parses each comment on its own and drops invalid ones, so one bad comment does not hide the rest. */
export const parsePublicComments = (data: unknown): TPublicComment[] => {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item: unknown) => {
    const result = publicCommentSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
};
