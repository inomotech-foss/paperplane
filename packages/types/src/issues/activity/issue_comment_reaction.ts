/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";

export type TIssueCommentReaction = ApiSchema<"CommentReaction">;

export type TIssueCommentReactionMap = {
  [reaction_id: string]: TIssueCommentReaction;
};

export type TIssueCommentReactionIdMap = {
  [comment_id: string]: { [reaction: string]: string[] };
};
