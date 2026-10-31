// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiSchema } from "@plane/api-types";
import { isPlainObject } from "@plane/types";
import type {
  ISearchIssueResponse,
  TBaseIssue,
  TIssue,
  TIssueLink,
  TIssuePriorities,
  TIssueRelationTypes,
  TIssueRow,
  TIssueResponseResults,
  TIssuesResponse,
  TLinkMetadata,
  TRelatedIssue,
  TStateGroups,
} from "@plane/types";

const PRIORITIES: readonly TIssuePriorities[] = ["urgent", "high", "medium", "low", "none"];

export const toIssuePriority = (value: unknown): TIssuePriorities | null =>
  PRIORITIES.find((priority) => priority === value) ?? null;

/** The columns every work item row of the API has. Counts and id lists are missing or null on some endpoints. */
type TWorkItemRow = {
  id: string;
  name: string;
  sequence_id: number;
  sort_order: number;
  state_id: string | null;
  priority: string | null;
  estimate_point: string | null;
  project_id: string | null;
  parent_id: string | null;
  type_id: string;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  is_draft: boolean;
  cycle_id?: string | null;
  label_ids?: string[];
  assignee_ids?: string[];
  module_ids?: string[];
  sub_issues_count?: number | null;
  attachment_count?: number | null;
  link_count?: number | null;
  is_intake?: boolean;
  state__group?: string | null;
};

/** A work item row of the API as the stores keep it. */
export function toBaseIssue(row: TWorkItemRow): TIssueRow {
  return {
    id: row.id,
    name: row.name,
    sequence_id: row.sequence_id,
    sort_order: row.sort_order,
    state_id: row.state_id,
    priority: toIssuePriority(row.priority),
    estimate_point: row.estimate_point,
    project_id: row.project_id,
    parent_id: row.parent_id,
    type_id: row.type_id,
    start_date: row.start_date,
    target_date: row.target_date,
    completed_at: row.completed_at,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    is_draft: row.is_draft,
    // The stores merge rows into what they hold, so a column the endpoint does not send stays out.
    ...(row.cycle_id === undefined ? {} : { cycle_id: row.cycle_id }),
    ...(row.label_ids === undefined ? {} : { label_ids: row.label_ids }),
    ...(row.assignee_ids === undefined ? {} : { assignee_ids: row.assignee_ids }),
    ...(row.module_ids === undefined ? {} : { module_ids: row.module_ids }),
    ...(row.sub_issues_count === undefined ? {} : { sub_issues_count: row.sub_issues_count ?? 0 }),
    ...(row.attachment_count === undefined ? {} : { attachment_count: row.attachment_count ?? 0 }),
    ...(row.link_count === undefined ? {} : { link_count: row.link_count ?? 0 }),
    ...(row.is_intake === undefined ? {} : { is_intake: row.is_intake }),
  };
}

type TIssueDetail = ApiSchema<"ExpandedIssueDetail">;

/** A work item from the detail endpoints. The expanded parent stays a partial work item. */
export function toIssue(detail: TIssueDetail): TIssueRow {
  return {
    ...toBaseIssue(detail),
    description_html: detail.description_html,
    ...(detail.is_subscribed === undefined ? {} : { is_subscribed: detail.is_subscribed }),
    ...(detail.parent ? { parent: { ...detail.parent } } : {}),
  };
}

const optionalString = (value: unknown): string | null | undefined =>
  typeof value === "string" || value === null ? value : undefined;

/** Link metadata is filled in by a crawler, so every key is optional and checked. */
export function toLinkMetadata(value: unknown): TLinkMetadata {
  if (!isPlainObject(value)) return {};
  const metadata: TLinkMetadata = {};
  const title = optionalString(value.title);
  const favicon = optionalString(value.favicon);
  const faviconUrl = optionalString(value.favicon_url);
  if (title !== undefined) metadata.title = title;
  if (favicon !== undefined) metadata.favicon = favicon;
  if (faviconUrl !== undefined) metadata.favicon_url = faviconUrl;
  if (typeof value.url === "string") metadata.url = value.url;
  if (typeof value.error === "string") metadata.error = value.error;
  return metadata;
}

type TLinkRow = ApiSchema<"IssueLink"> | ApiSchema<"IssueLinkLite">;

/** The link endpoints and the issue_link expansion name the issue and the creator differently. */
export function toIssueLink(row: TLinkRow): TIssueLink {
  const isLite = "issue_id" in row;
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    metadata: toLinkMetadata(row.metadata),
    issue_id: isLite ? row.issue_id : row.issue,
    created_by_id: isLite ? row.created_by_id : row.created_by,
    created_at: row.created_at,
  };
}

type TListRow = ApiSchema<"WorkItemListItem"> | ApiSchema<"WorkItemDetailRow"> | ApiSchema<"ViewWorkItem">;
type TListPage =
  | ApiSchema<"WorkItemListResponse">
  | ApiSchema<"PaginatedWorkItemDetailRowList">
  | ApiSchema<"PaginatedViewWorkItemList">;

const RELATION_TYPES: readonly TIssueRelationTypes[] = ["blocking", "blocked_by", "duplicate", "relates_to"];
const isRelationType = (value: string): value is TIssueRelationTypes =>
  RELATION_TYPES.some((relationType) => relationType === value);

type TExpandedRelation = ApiSchema<"ExpandedRelation">;
type TIssueRelationRow = NonNullable<TIssue["issue_relation"]>[number];

/** Expanded relations of a list row. A row with a relation type the client does not know is skipped. */
export function toIssueRelations(rows: TExpandedRelation[]): TIssueRelationRow[] {
  const relations: TIssueRelationRow[] = [];
  for (const row of rows) {
    const relationType = row.relation_type;
    if (!isRelationType(relationType)) continue;
    relations.push({
      id: row.id,
      name: row.name,
      project_id: row.project_id,
      sequence_id: row.sequence_id,
      relation_type: relationType,
    });
  }
  return relations;
}

const toListIssue = (row: TListRow): TIssueRow => {
  const issue: TIssueRow = toBaseIssue(row);
  if ("state__group" in row && row.state__group !== undefined) {
    const group = row.state__group;
    if (group === null || isStateGroup(group)) issue.state__group = group;
  }
  if ("issue_relation" in row && row.issue_relation) issue.issue_relation = toIssueRelations(row.issue_relation);
  if ("issue_related" in row && row.issue_related) issue.issue_related = toIssueRelations(row.issue_related);
  return issue;
};

const STATE_GROUPS: readonly TStateGroups[] = ["backlog", "unstarted", "started", "completed", "cancelled"];
const isStateGroup = (value: string): value is TStateGroups => STATE_GROUPS.some((group) => group === value);

type TGroup = ApiSchema<"WorkItemGroup">;
type TSubGroupedGroup = ApiSchema<"WorkItemSubGroupedGroup">;

const isFlatGroup = (group: TGroup | TSubGroupedGroup): group is TGroup => Array.isArray(group.results);

function toSubGroups(group: TSubGroupedGroup): Record<string, { results: TIssueRow[]; total_results: number }> {
  const subGroups: Record<string, { results: TIssueRow[]; total_results: number }> = {};
  for (const [subGroupId, subGroup] of Object.entries(group.results)) {
    subGroups[subGroupId] = { results: subGroup.results.map(toListIssue), total_results: subGroup.total_results };
  }
  return subGroups;
}

function toResults(results: TListPage["results"]): TIssueResponseResults {
  if (Array.isArray(results)) return results.map(toListIssue);
  const groups: Exclude<TIssueResponseResults, TIssueRow[]> = {};
  for (const [groupId, group] of Object.entries<TGroup | TSubGroupedGroup>(results)) {
    groups[groupId] = isFlatGroup(group)
      ? { results: group.results.map(toListIssue), total_results: group.total_results ?? 0 }
      : { results: toSubGroups(group), total_results: group.total_results };
  }
  return groups;
}

/** A page of a work item list as the stores read it. */
export function toIssuesResponse(page: TListPage): TIssuesResponse {
  return {
    grouped_by: page.grouped_by,
    next_cursor: page.next_cursor,
    prev_cursor: page.prev_cursor,
    next_page_results: page.next_page_results,
    prev_page_results: page.prev_page_results,
    total_count: page.total_count,
    count: page.count,
    total_pages: page.total_pages,
    total_results: page.total_results,
    results: toResults(page.results),
  };
}

type TRelationRow = ApiSchema<"RelatedWorkItem"> | ApiSchema<"IssueRelation">;

/** The work item fields a relation row carries, without inventing the rest. */
export function toRelatedIssue(row: TRelationRow): TRelatedIssue {
  const issue: TRelatedIssue = {
    id: row.id,
    name: row.name,
    sequence_id: row.sequence_id,
    project_id: row.project_id,
    priority: toIssuePriority(row.priority),
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
  if (row.state_id !== undefined) issue.state_id = row.state_id;
  if ("type_id" in row) {
    issue.type_id = row.type_id;
    issue.sort_order = row.sort_order;
    issue.label_ids = row.label_ids;
    issue.assignee_ids = row.assignee_ids;
  }
  return issue;
}

/** A search hit. The state columns are null for a work item without a state. */
export const toSearchIssue = (row: ApiSchema<"WorkItemSearchResult">): ISearchIssueResponse => ({
  ...row,
  state__group: row.state__group !== null && isStateGroup(row.state__group) ? row.state__group : null,
});

type TIssueWriteBody = ApiSchema<"PatchedIssueUpdateRequest">;

const isSet = <T>(value: T | undefined): value is T => value !== undefined;

/** The writable work item fields of a store payload. Other keys, such as cycle_id, have their own endpoints. */
export function toIssueWriteBody(data: Partial<TIssue>): TIssueWriteBody {
  const body: TIssueWriteBody = {};
  if (isSet(data.name)) body.name = data.name;
  if (isSet(data.description_html)) body.description_html = data.description_html;
  if (isSet(data.state_id)) body.state_id = data.state_id;
  if (isSet(data.parent_id)) body.parent_id = data.parent_id;
  if (isSet(data.type_id)) body.type_id = data.type_id;
  if (isSet(data.label_ids)) body.label_ids = data.label_ids;
  if (isSet(data.assignee_ids)) body.assignee_ids = data.assignee_ids;
  if (isSet(data.estimate_point)) body.estimate_point = data.estimate_point;
  if (isSet(data.start_date)) body.start_date = data.start_date;
  if (isSet(data.target_date)) body.target_date = data.target_date;
  if (isSet(data.sort_order)) body.sort_order = data.sort_order;
  if (isSet(data.is_draft)) body.is_draft = data.is_draft;
  if (data.priority) body.priority = data.priority;
  // Editors send skip_activity with a migrated description so the change makes no activity.
  if ("skip_activity" in data && (data.skip_activity === true || data.skip_activity === "true")) {
    body.skip_activity = true;
  }
  return body;
}

/** A create body. The API rejects a work item without a type. */
export function toIssueCreateBody(data: Partial<TIssue>): ApiSchema<"IssueCreateRequest"> {
  const { type_id: typeId } = data;
  if (!typeId) throw new Error("A work item needs a type");
  const { skip_activity: _skip, ...body } = toIssueWriteBody(data);
  return { ...body, name: data.name ?? "", type_id: typeId };
}
