// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TIssueReaction } from "@plane/types";

/** Who reacted, by member name, else the name the reaction carries for people who left the workspace. */
export const getReactionUserNames = (
  reactionIds: string[],
  getReaction: (reactionId: string) => Pick<TIssueReaction, "actor" | "actor_detail"> | undefined,
  getMemberName: (userId: string) => string | undefined
): string[] =>
  reactionIds.flatMap((reactionId) => {
    const reaction = getReaction(reactionId);
    if (!reaction) return [];
    const name = getMemberName(reaction.actor) || reaction.actor_detail?.display_name;
    return name ? [name] : [];
  });
