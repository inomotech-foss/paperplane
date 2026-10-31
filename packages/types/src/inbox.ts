/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane types
import type { TPaginationInfo } from "./common";
import type { TIssuePriorities } from "./issues";
import type { TIssue } from "./issues/issue";

export enum EInboxIssueCurrentTab {
  OPEN = "open",
  CLOSED = "closed",
}

export type TInboxIssueCurrentTab = EInboxIssueCurrentTab;

export enum EInboxIssueStatus {
  PENDING = -2,
  DECLINED = -1,
  SNOOZED = 0,
  ACCEPTED = 1,
  DUPLICATE = 2,
}

export enum EInboxIssueSource {
  IN_APP = "IN_APP",
  FORMS = "FORMS",
  EMAIL = "EMAIL",
}

export type TInboxIssueStatus = EInboxIssueStatus;

/** The list sends a few fields of the work item, the detail sends most of them. */
export type TInboxIssueDetails = Partial<TIssue> & Pick<TIssue, "id">;

export type TInboxIssue = {
  id: string;
  status: TInboxIssueStatus;
  snoozed_till: Date | null;
  duplicate_to: string | undefined;
  source: EInboxIssueSource | undefined;
  issue: TInboxIssueDetails;
  created_by: string | undefined;
  duplicate_issue_detail: TInboxDuplicateIssueDetails | undefined;
};

// filters
export type TInboxIssueFilterMemberKeys = "assignees" | "created_by";

export type TInboxIssueFilterDateKeys = "created_at" | "updated_at";

export type TInboxIssueFilter = {
  [key in TInboxIssueFilterMemberKeys]: string[] | undefined;
} & {
  [key in TInboxIssueFilterDateKeys]: string[] | undefined;
} & {
  state: string[] | undefined;
  status: TInboxIssueStatus[] | undefined;
  priority: TIssuePriorities[] | undefined;
  labels: string[] | undefined;
};

// sorting filters
export type TInboxIssueSortingKeys = "order_by" | "sort_by";

export type TInboxIssueSortingOrderByKeys = "issue__created_at" | "issue__updated_at" | "issue__sequence_id";

export type TInboxIssueSortingSortByKeys = "asc" | "desc";

export type TInboxIssueSorting = {
  order_by: TInboxIssueSortingOrderByKeys | undefined;
  sort_by: TInboxIssueSortingSortByKeys | undefined;
};

// filtering and sorting types for query params
export type TInboxIssueSortingOrderByQueryParamKeys =
  | "issue__created_at"
  | "-issue__created_at"
  | "issue__updated_at"
  | "-issue__updated_at"
  | "issue__sequence_id"
  | "-issue__sequence_id";

export type TInboxIssueSortingOrderByQueryParam = {
  order_by: TInboxIssueSortingOrderByQueryParamKeys;
};

export type TInboxIssuesQueryParams = {
  [key in keyof TInboxIssueFilter]: string;
} & TInboxIssueSortingOrderByQueryParam & {
    per_page: number;
    cursor: string;
  };

// inbox issue types

export type TInboxDuplicateIssueDetails = {
  id: string;
  sequence_id: number;
  name: string;
};

export type TInboxIssuePaginationInfo = TPaginationInfo & {
  total_results: number;
};

export type TInboxIssueWithPagination = TInboxIssuePaginationInfo & {
  results: TInboxIssue[];
};

export type TAnchors = { [key: string]: string };

export type TInboxForm = {
  anchors: TAnchors;
  id: string;
  is_in_app_enabled: boolean;
  is_form_enabled: boolean;
};

export type TInboxIssueForm = {
  name: string;
  description: string;
  username: string;
  email: string;
};
