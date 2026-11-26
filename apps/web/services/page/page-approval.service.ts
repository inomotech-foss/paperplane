/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TPageApprovalStatus = ApiSchema<"PageApprovalStatusWithAbilities">;
export type TPageApprovalState = ApiSchema<"PageApprovalStatusEnum">;
export type TPageApprovalEvent = ApiSchema<"PageApprovalEvent">;
export type TPageApprovalRegisterRow = ApiSchema<"PageApprovalRegisterRow">;
export type TPageApprover = ApiSchema<"PageApprover">;

// Hand-written until the API types are regenerated: PageBaselinePreview, PageBaselineRequest, PageBaselineQueued.
export type TPageBaselineSkipReason =
  | "archived"
  | "already_baselined"
  | "already_approved"
  | "in_review"
  | "rejected"
  | "has_approval_history"
  | "locked";
export type TPageBaselineLegacyKind = "approved" | "other" | "none";
export type TPageBaselineCandidate = {
  page: string;
  name: string;
  is_locked: boolean;
  skip_reason: TPageBaselineSkipReason | null;
  skip_reason_label: string;
  legacy_kind: TPageBaselineLegacyKind | null;
  legacy_note: string;
};
export type TPageBaselinePreview = {
  pages: TPageBaselineCandidate[];
  totals: {
    pages: number;
    eligible: number;
    locked: number;
    skipped: number;
    legacy_approved: number;
    legacy_other: number;
    legacy_none: number;
  };
};
export type TPageBaselineRequest = {
  page_ids?: string[];
  next_review_date?: string | null;
  comment?: string;
  include_locked?: boolean;
};
export type TPageBaselineQueued = { queued: number; skipped: number };

const pagePath = (slug: string, project_id: string, page_id: string) => ({ path: { slug, project_id, page_id } });
const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });

/**
 * Review and approval of pages, for projects that switch it on.
 * Errors are thrown as `ApiError` from `@plane/services`; refusals carry an `error_code`.
 */
export class PageApprovalService {
  async getStatus(workspaceSlug: string, projectId: string, pageId: string): Promise<TPageApprovalStatus> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/approval/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
  }

  async listEvents(workspaceSlug: string, projectId: string, pageId: string): Promise<TPageApprovalEvent[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/approval/events/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
  }

  async submit(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    comment: string
  ): Promise<TPageApprovalStatus> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/approval/submit/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: { comment },
      })
    );
  }

  async approve(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    data: { comment: string; next_review_date: string | null }
  ): Promise<TPageApprovalStatus> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/approval/approve/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: data,
      })
    );
  }

  async reject(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    comment: string
  ): Promise<TPageApprovalStatus> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/approval/reject/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: { comment },
      })
    );
  }

  async setReviewDate(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    nextReviewDate: string | null
  ): Promise<TPageApprovalStatus> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/approval/review-date/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: { next_review_date: nextReviewDate, comment: "" },
      })
    );
  }

  async register(workspaceSlug: string, projectId: string): Promise<TPageApprovalRegisterRow[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/page-approvals/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  /** What baselining would do for each page of the project. Project admins only; writes nothing. */
  async baselinePreview(workspaceSlug: string, projectId: string): Promise<TPageBaselinePreview> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/page-approvals/baseline/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  /** Queues the pages for baselining; the work runs in the background. */
  async baseline(workspaceSlug: string, projectId: string, data: TPageBaselineRequest): Promise<TPageBaselineQueued> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/page-approvals/baseline/", {
        params: projectPath(workspaceSlug, projectId),
        body: data,
      })
    );
  }

  async listApprovers(workspaceSlug: string, projectId: string): Promise<TPageApprover[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/page-approvers/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  async setApprovers(workspaceSlug: string, projectId: string, memberIds: string[]): Promise<TPageApprover[]> {
    return unwrap(
      apiClient.PUT("/api/workspaces/{slug}/projects/{project_id}/page-approvers/", {
        params: projectPath(workspaceSlug, projectId),
        body: { member_ids: memberIds },
      })
    );
  }
}
