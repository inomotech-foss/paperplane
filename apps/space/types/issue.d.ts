import type { ActorDetail, TIssuePriorities } from "@plane/types";
import type { TPublicLabel } from "@/services/project.service";
import type { TPublicComment } from "@/services/public-comment";

export type TIssueLayout = "list" | "kanban" | "calendar" | "spreadsheet" | "gantt";
export type TIssueLayoutOptions = {
  [key in TIssueLayout]: boolean;
};

export type TIssueFilterPriorityObject = {
  key: TIssuePriorities;
  title: string;
  className: string;
  icon: string;
};

export type TIssueFilterKeys = "priority" | "state" | "labels";

export type TDisplayFilters = {
  layout: TIssueLayout;
};

export type TFilters = {
  /** State ids. */
  state: string[];
  priority: TIssuePriorities[];
  labels: string[];
};

export type TIssueFilters = {
  display_filters: TDisplayFilters;
  filters: TFilters;
};

export type TIssueQueryFilters = Partial<TFilters>;

export type TIssueQueryFiltersParams = Partial<Record<keyof TFilters, string>>;

export interface IIssue {
  id: string;
  name: string;
  state_id: string | null;
  sort_order: number;
  estimate_point: string | null;
  priority: TIssuePriorities;
  start_date: string | null;
  target_date: string | null;
  sequence_id: number;
  project_id: string;
  parent_id: string | null;
  cycle_id: string | null;
  created_by: string | null;
  module_ids: string[];
  label_ids: string[];
  assignee_ids: string[];
  /** Only the detail response has the description. */
  description_html?: string;
  attachment_count?: number;
  sub_issues_count?: number;
  link_count?: number;
  comments?: TPublicComment[];
  reaction_items: IIssueReaction[];
  vote_items: IVote[] | null;
}

export type IPeekMode = "side" | "modal" | "full";

export type IIssueLabel = TPublicLabel;

export interface IVote {
  vote: -1 | 1;
  actor_details: ActorDetail;
}

export interface IIssueReaction {
  actor_details: ActorDetail;
  reaction: string;
}

export interface IIssueFilterOptions {
  state?: string[] | null;
  labels?: string[] | null;
  priority?: string[] | null;
}
