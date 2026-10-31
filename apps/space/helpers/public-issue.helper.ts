/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import type { ActorDetail } from "@plane/types";
import type { IIssue, IIssueReaction, IVote } from "@/types/issue";
import { isIssuePriority } from "./narrow.helper";

type TPublicActor = ApiSchema<"PublicActor">;
type TPublicIssueItem = ApiSchema<"PublicWorkItemListItem"> | ApiSchema<"PublicWorkItem">;

export const toActorDetail = (actor: TPublicActor): ActorDetail => ({
  id: actor.id,
  first_name: actor.first_name,
  last_name: actor.last_name,
  display_name: actor.display_name,
  avatar_url: actor.avatar_url ?? undefined,
});

export const toVotes = (votes: ApiSchema<"PublicVote">[]): IVote[] =>
  votes.flatMap((item) =>
    item.vote === 1 || item.vote === -1 ? [{ vote: item.vote, actor_details: toActorDetail(item.actor_details) }] : []
  );

export const toReactions = (reactions: ApiSchema<"PublicReaction">[]): IIssueReaction[] =>
  reactions.map((item) => ({ reaction: item.reaction, actor_details: toActorDetail(item.actor_details) }));

/** Maps a work item from the public list or detail response to the store shape. */
export const toIssue = (item: TPublicIssueItem): IIssue => ({
  id: item.id,
  name: item.name,
  state_id: item.state_id,
  sort_order: item.sort_order,
  estimate_point: item.estimate_point,
  priority: isIssuePriority(item.priority) ? item.priority : "none",
  start_date: item.start_date,
  target_date: item.target_date,
  sequence_id: item.sequence_id,
  project_id: item.project_id,
  parent_id: item.parent_id,
  cycle_id: item.cycle_id,
  created_by: item.created_by,
  module_ids: item.module_ids ?? [],
  label_ids: item.label_ids ?? [],
  assignee_ids: item.assignee_ids ?? [],
  description_html: "description_html" in item ? item.description_html : undefined,
  vote_items: item.vote_items ? toVotes(item.vote_items) : null,
  reaction_items: toReactions(item.reaction_items ?? []),
});
