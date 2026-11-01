// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { EPageAccess, isRecord, parseLogoProps } from "@plane/types";
import type { TPage, TPageAttachment, TPageComment, TPageCommentReaction, TPageVersion, IUserLite } from "@plane/types";

type TPageRow = ApiSchema<"Page"> | ApiSchema<"PageDetail"> | ApiSchema<"PageWithIssues"> | ApiSchema<"PageUpdate">;

export type TPageCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/pages/", "post">;
export type TPageUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/", "patch">;
export type TPageCommentBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/",
  "post"
>;

export const toPageAccess = (access: ApiSchema<"PageAccessEnum">): EPageAccess =>
  access === 1 ? EPageAccess.PRIVATE : EPageAccess.PUBLIC;

const toObject = (value: unknown): object => (isRecord(value) ? value : {});

/** A page of any page endpoint. The list sends no description, so it stays out and store merges keep it. */
export function toPage(row: TPageRow): TPage {
  const page: TPage = {
    id: row.id,
    name: row.name,
    owned_by: row.owned_by,
    access: toPageAccess(row.access),
    color: row.color,
    parent: row.parent,
    sort_order: row.sort_order,
    is_favorite: row.is_favorite ?? false,
    is_locked: row.is_locked,
    archived_at: row.archived_at,
    workspace: row.workspace,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    logo_props: parseLogoProps(row.logo_props),
    label_ids: row.label_ids,
    project_ids: row.project_ids,
  };
  if ("description_html" in row) page.description_html = row.description_html;
  return page;
}

/** The fields of `data` a page create accepts. */
export const toPageCreateBody = (data: Partial<TPage>): TPageCreateBody => ({
  name: data.name,
  access: data.access,
  color: data.color,
  parent: data.parent,
  sort_order: data.sort_order,
  logo_props: data.logo_props,
  labels: data.label_ids,
  description_html: data.description_html,
});

/** The fields of `data` a page update accepts. Moves go through the position endpoint. */
export const toPageUpdateBody = (data: Partial<TPage>): TPageUpdateBody => ({
  name: data.name,
  access: data.access,
  color: data.color,
  logo_props: data.logo_props,
  labels: data.label_ids,
  description_html: data.description_html,
});

/** A page version. The list sends no description. */
export function toPageVersion(row: ApiSchema<"PageVersion"> | ApiSchema<"PageVersionDetail">): TPageVersion {
  const version: TPageVersion = {
    id: row.id,
    page: row.page,
    workspace: row.workspace,
    owned_by: row.owned_by,
    last_saved_at: row.last_saved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
  if ("description_html" in row) {
    version.description_html = row.description_html;
    version.description_binary = row.description_binary;
    version.description_json = toObject(row.description_json);
  }
  return version;
}

const toUserLite = (user: ApiSchema<"UserLite"> | null | undefined): IUserLite | undefined =>
  user
    ? {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        display_name: user.display_name,
        is_bot: user.is_bot,
      }
    : undefined;

export const toPageCommentReaction = (row: ApiSchema<"PageCommentReaction">): TPageCommentReaction => ({
  id: row.id,
  comment: row.comment,
  actor: row.actor,
  reaction: row.reaction,
});

export function toPageComment(row: ApiSchema<"PageComment">): TPageComment {
  const comment: TPageComment = {
    id: row.id,
    page: row.page,
    workspace: row.workspace,
    parent: row.parent,
    anchor_id: row.anchor_id,
    comment_html: row.comment_html,
    comment_json: toObject(row.comment_json),
    comment_stripped: row.comment_stripped,
    actor: row.actor,
    is_resolved: row.is_resolved,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    edited_at: row.edited_at,
    comment_reactions: row.comment_reactions.map(toPageCommentReaction),
    external_id: row.external_id,
    external_source: row.external_source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
  const actor = toUserLite(row.actor_detail);
  if (actor) comment.actor_detail = actor;
  const resolver = toUserLite(row.resolved_by_detail);
  if (resolver) comment.resolved_by_detail = resolver;
  return comment;
}

export const toPageAttachment = (row: ApiSchema<"PageAttachment">): TPageAttachment => ({
  id: row.id,
  attributes: row.attributes,
  asset_url: row.asset_url,
  page: row.page ?? null,
  created_at: row.created_at,
  created_by: row.created_by,
  updated_at: row.updated_at,
  updated_by: row.updated_by,
});
