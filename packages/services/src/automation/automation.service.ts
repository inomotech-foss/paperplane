/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import {
  parseAutomationActionConfig,
  parseAutomationCondition,
  parseAutomationRunSteps,
  parseAutomationTriggerConfig,
} from "@plane/types";
import type {
  TAutomation,
  TAutomationAction,
  TAutomationActionCreatePayload,
  TAutomationActionPayload,
  TAutomationMetadata,
  TAutomationPayload,
  TAutomationRun,
} from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TPaginatedRuns = {
  count: number;
  total_count: number;
  next_cursor: string;
  next_page_results: boolean;
  results: TAutomationRun[];
};

export const toAutomationAction = (row: ApiSchema<"AutomationAction">): TAutomationAction => ({
  id: row.id,
  automation: row.automation,
  action_type: row.action_type,
  config: parseAutomationActionConfig(row.action_type, row.config),
  sort_order: row.sort_order,
  created_at: row.created_at,
  updated_at: row.updated_at,
  created_by: row.created_by,
});

export const toAutomation = (row: ApiSchema<"Automation">): TAutomation => ({
  id: row.id,
  workspace: row.workspace,
  project: row.project,
  scope: row.scope,
  applies_to_all_projects: row.applies_to_all_projects,
  projects: row.projects,
  name: row.name,
  description: row.description,
  trigger_type: row.trigger_type,
  trigger_config: parseAutomationTriggerConfig(row.trigger_config),
  condition: parseAutomationCondition(row.condition),
  is_enabled: row.is_enabled,
  next_run_at: row.next_run_at,
  last_run_at: row.last_run_at,
  last_run_status: row.last_run_status,
  total_run_count: row.total_run_count,
  failed_run_count: row.failed_run_count,
  average_duration_ms: row.average_duration_ms,
  schedule_summary: row.schedule_summary,
  owned_by: row.owned_by,
  actions: row.actions.map(toAutomationAction),
  created_at: row.created_at,
  updated_at: row.updated_at,
  created_by: row.created_by,
  updated_by: row.updated_by,
});

export const toAutomationRun = (row: ApiSchema<"AutomationRun">): TAutomationRun => ({
  id: row.id,
  automation: row.automation,
  project: row.project,
  status: row.status,
  trigger_source: row.trigger_source,
  trigger_type: row.trigger_type,
  entity_type: row.entity_type,
  entity_identifier: row.entity_identifier,
  initiator: row.initiator,
  started_at: row.started_at,
  finished_at: row.finished_at,
  duration_ms: row.duration_ms,
  processed_count: row.processed_count,
  steps: parseAutomationRunSteps(row.steps),
  error: row.error,
});

/** Errors are thrown as `ApiError`. Each method addresses the project automations when `projectId` is given. */
export class AutomationService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  async metadata(workspaceSlug: string): Promise<TAutomationMetadata> {
    return unwrap(
      this.client.GET("/api/workspaces/{slug}/automation-metadata/", { params: { path: { slug: workspaceSlug } } })
    );
  }

  async list(workspaceSlug: string, projectId?: string): Promise<TAutomation[]> {
    const rows = projectId
      ? await unwrap(
          this.client.GET("/api/workspaces/{slug}/projects/{project_id}/automations/", {
            params: { path: { slug: workspaceSlug, project_id: projectId } },
          })
        )
      : await unwrap(
          this.client.GET("/api/workspaces/{slug}/automations/", { params: { path: { slug: workspaceSlug } } })
        );
    return rows.map(toAutomation);
  }

  async retrieve(workspaceSlug: string, automationId: string, projectId?: string): Promise<TAutomation> {
    const row = projectId
      ? await unwrap(
          this.client.GET("/api/workspaces/{slug}/projects/{project_id}/automations/{pk}/", {
            params: { path: { slug: workspaceSlug, project_id: projectId, pk: automationId } },
          })
        )
      : await unwrap(
          this.client.GET("/api/workspaces/{slug}/automations/{pk}/", {
            params: { path: { slug: workspaceSlug, pk: automationId } },
          })
        );
    return toAutomation(row);
  }

  async create(workspaceSlug: string, data: TAutomationPayload, projectId?: string): Promise<TAutomation> {
    const body = { ...data, name: data.name ?? "" };
    const row = projectId
      ? await unwrap(
          this.client.POST("/api/workspaces/{slug}/projects/{project_id}/automations/", {
            params: { path: { slug: workspaceSlug, project_id: projectId } },
            body,
          })
        )
      : await unwrap(
          this.client.POST("/api/workspaces/{slug}/automations/", { params: { path: { slug: workspaceSlug } }, body })
        );
    return toAutomation(row);
  }

  async update(
    workspaceSlug: string,
    automationId: string,
    data: TAutomationPayload,
    projectId?: string
  ): Promise<TAutomation> {
    const row = projectId
      ? await unwrap(
          this.client.PATCH("/api/workspaces/{slug}/projects/{project_id}/automations/{pk}/", {
            params: { path: { slug: workspaceSlug, project_id: projectId, pk: automationId } },
            body: data,
          })
        )
      : await unwrap(
          this.client.PATCH("/api/workspaces/{slug}/automations/{pk}/", {
            params: { path: { slug: workspaceSlug, pk: automationId } },
            body: data,
          })
        );
    return toAutomation(row);
  }

  async destroy(workspaceSlug: string, automationId: string, projectId?: string): Promise<void> {
    if (projectId) {
      return unwrap(
        this.client.DELETE("/api/workspaces/{slug}/projects/{project_id}/automations/{pk}/", {
          params: { path: { slug: workspaceSlug, project_id: projectId, pk: automationId } },
        })
      );
    }
    return unwrap(
      this.client.DELETE("/api/workspaces/{slug}/automations/{pk}/", {
        params: { path: { slug: workspaceSlug, pk: automationId } },
      })
    );
  }

  async createAction(
    workspaceSlug: string,
    automationId: string,
    body: TAutomationActionCreatePayload,
    projectId?: string
  ): Promise<TAutomationAction> {
    const row = projectId
      ? await unwrap(
          this.client.POST("/api/workspaces/{slug}/projects/{project_id}/automations/{automation_id}/actions/", {
            params: { path: { slug: workspaceSlug, project_id: projectId, automation_id: automationId } },
            body,
          })
        )
      : await unwrap(
          this.client.POST("/api/workspaces/{slug}/automations/{automation_id}/actions/", {
            params: { path: { slug: workspaceSlug, automation_id: automationId } },
            body,
          })
        );
    return toAutomationAction(row);
  }

  async updateAction(
    workspaceSlug: string,
    automationId: string,
    actionId: string,
    data: TAutomationActionPayload,
    projectId?: string
  ): Promise<TAutomationAction> {
    const row = projectId
      ? await unwrap(
          this.client.PATCH("/api/workspaces/{slug}/projects/{project_id}/automations/{automation_id}/actions/{pk}/", {
            params: { path: { slug: workspaceSlug, project_id: projectId, automation_id: automationId, pk: actionId } },
            body: data,
          })
        )
      : await unwrap(
          this.client.PATCH("/api/workspaces/{slug}/automations/{automation_id}/actions/{pk}/", {
            params: { path: { slug: workspaceSlug, automation_id: automationId, pk: actionId } },
            body: data,
          })
        );
    return toAutomationAction(row);
  }

  async destroyAction(
    workspaceSlug: string,
    automationId: string,
    actionId: string,
    projectId?: string
  ): Promise<void> {
    if (projectId) {
      return unwrap(
        this.client.DELETE("/api/workspaces/{slug}/projects/{project_id}/automations/{automation_id}/actions/{pk}/", {
          params: { path: { slug: workspaceSlug, project_id: projectId, automation_id: automationId, pk: actionId } },
        })
      );
    }
    return unwrap(
      this.client.DELETE("/api/workspaces/{slug}/automations/{automation_id}/actions/{pk}/", {
        params: { path: { slug: workspaceSlug, automation_id: automationId, pk: actionId } },
      })
    );
  }

  async listRuns(
    workspaceSlug: string,
    automationId: string,
    projectId?: string,
    params?: { cursor?: string; status?: TAutomationRun["status"] }
  ): Promise<TPaginatedRuns> {
    const page = projectId
      ? await unwrap(
          this.client.GET("/api/workspaces/{slug}/projects/{project_id}/automations/{automation_id}/runs/", {
            params: {
              path: { slug: workspaceSlug, project_id: projectId, automation_id: automationId },
              query: params,
            },
          })
        )
      : await unwrap(
          this.client.GET("/api/workspaces/{slug}/automations/{automation_id}/runs/", {
            params: { path: { slug: workspaceSlug, automation_id: automationId }, query: params },
          })
        );
    return {
      count: page.count,
      total_count: page.total_count,
      next_cursor: page.next_cursor,
      next_page_results: page.next_page_results,
      results: page.results.map(toAutomationRun),
    };
  }

  async runNow(workspaceSlug: string, automationId: string, projectId?: string): Promise<{ message: string }> {
    if (projectId) {
      return unwrap(
        this.client.POST("/api/workspaces/{slug}/projects/{project_id}/automations/{automation_id}/runs/", {
          params: { path: { slug: workspaceSlug, project_id: projectId, automation_id: automationId } },
        })
      );
    }
    return unwrap(
      this.client.POST("/api/workspaces/{slug}/automations/{automation_id}/runs/", {
        params: { path: { slug: workspaceSlug, automation_id: automationId } },
      })
    );
  }
}
