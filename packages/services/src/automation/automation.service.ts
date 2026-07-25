/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TAutomation,
  TAutomationAction,
  TAutomationActionPayload,
  TAutomationMetadata,
  TAutomationPayload,
  TAutomationRun,
} from "@plane/types";
import { APIService } from "../api.service";

type TPaginatedRuns = {
  count: number;
  total_count: number;
  next_cursor: string;
  next_page_results: boolean;
  results: TAutomationRun[];
};

/**
 * Service for the automation designer.
 *
 * Automations exist at two scopes and the REST paths differ only by whether a
 * project id is present, so every method takes an optional `projectId`: pass it
 * for project-scoped rules, omit it for workspace-scoped (global) ones.
 */
export class AutomationService extends APIService {
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
  }

  /**
   * Builds the collection URL for the requested scope.
   */
  private basePath(workspaceSlug: string, projectId?: string): string {
    return projectId
      ? `/api/workspaces/${workspaceSlug}/projects/${projectId}/automations/`
      : `/api/workspaces/${workspaceSlug}/automations/`;
  }

  /**
   * The trigger, condition and action vocabulary the designer renders from.
   * Static per deployment, so it is safe to fetch once per session.
   */
  async metadata(workspaceSlug: string): Promise<TAutomationMetadata> {
    return this.get(`/api/workspaces/${workspaceSlug}/automation-metadata/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async list(workspaceSlug: string, projectId?: string): Promise<TAutomation[]> {
    return this.get(this.basePath(workspaceSlug, projectId))
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async retrieve(workspaceSlug: string, automationId: string, projectId?: string): Promise<TAutomation> {
    return this.get(`${this.basePath(workspaceSlug, projectId)}${automationId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, data: TAutomationPayload, projectId?: string): Promise<TAutomation> {
    return this.post(this.basePath(workspaceSlug, projectId), data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    automationId: string,
    data: TAutomationPayload,
    projectId?: string
  ): Promise<TAutomation> {
    return this.patch(`${this.basePath(workspaceSlug, projectId)}${automationId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Deleting requires the automation to be disabled first; the API answers 400
   * with an `error` message when it is not.
   */
  async destroy(workspaceSlug: string, automationId: string, projectId?: string): Promise<void> {
    return this.delete(`${this.basePath(workspaceSlug, projectId)}${automationId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async listActions(workspaceSlug: string, automationId: string, projectId?: string): Promise<TAutomationAction[]> {
    return this.get(`${this.basePath(workspaceSlug, projectId)}${automationId}/actions/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createAction(
    workspaceSlug: string,
    automationId: string,
    data: TAutomationActionPayload,
    projectId?: string
  ): Promise<TAutomationAction> {
    return this.post(`${this.basePath(workspaceSlug, projectId)}${automationId}/actions/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateAction(
    workspaceSlug: string,
    automationId: string,
    actionId: string,
    data: TAutomationActionPayload,
    projectId?: string
  ): Promise<TAutomationAction> {
    return this.patch(`${this.basePath(workspaceSlug, projectId)}${automationId}/actions/${actionId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async destroyAction(
    workspaceSlug: string,
    automationId: string,
    actionId: string,
    projectId?: string
  ): Promise<void> {
    return this.delete(`${this.basePath(workspaceSlug, projectId)}${automationId}/actions/${actionId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async listRuns(
    workspaceSlug: string,
    automationId: string,
    projectId?: string,
    params?: { cursor?: string; status?: string }
  ): Promise<TPaginatedRuns> {
    return this.get(`${this.basePath(workspaceSlug, projectId)}${automationId}/runs/`, { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Queues an immediate run. The automation must be enabled.
   */
  async runNow(workspaceSlug: string, automationId: string, projectId?: string): Promise<{ message: string }> {
    return this.post(`${this.basePath(workspaceSlug, projectId)}${automationId}/runs/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
