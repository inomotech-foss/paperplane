/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { IWebhook } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TWebhookCreateBody = ApiRequestBody<"/api/workspaces/{slug}/webhooks/", "post">;
export type TWebhookUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/webhooks/{pk}/", "patch">;

/** A webhook. The secret key is only sent on create and on regeneration. */
export function toWebhook(row: ApiSchema<"Webhook"> | ApiSchema<"WebhookWithoutSecret">): IWebhook {
  const webhook: IWebhook = {
    id: row.id,
    url: row.url,
    is_active: row.is_active,
    project: row.project,
    issue: row.issue,
    module: row.module,
    cycle: row.cycle,
    issue_comment: row.issue_comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if ("secret_key" in row) webhook.secret_key = row.secret_key;
  return webhook;
}

export const toWebhookUpdateBody = (data: Partial<IWebhook>): TWebhookUpdateBody => ({
  url: data.url,
  is_active: data.is_active,
  project: data.project,
  issue: data.issue,
  module: data.module,
  cycle: data.cycle,
  issue_comment: data.issue_comment,
});

export const toWebhookCreateBody = (data: Partial<IWebhook>): TWebhookCreateBody => ({
  ...toWebhookUpdateBody(data),
  url: data.url ?? "",
});

const workspacePath = (slug: string) => ({ path: { slug } });
const webhookPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class WebhookService {
  async fetchWebhooksList(workspaceSlug: string): Promise<IWebhook[]> {
    const webhooks = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/webhooks/", { params: workspacePath(workspaceSlug) })
    );
    return webhooks.map(toWebhook);
  }

  async fetchWebhookDetails(workspaceSlug: string, webhookId: string): Promise<IWebhook> {
    return toWebhook(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/webhooks/{pk}/", { params: webhookPath(workspaceSlug, webhookId) })
      )
    );
  }

  async createWebhook(workspaceSlug: string, data: Partial<IWebhook>): Promise<IWebhook> {
    return toWebhook(
      await unwrap(
        apiClient.POST("/api/workspaces/{slug}/webhooks/", {
          params: workspacePath(workspaceSlug),
          body: toWebhookCreateBody(data),
        })
      )
    );
  }

  async updateWebhook(workspaceSlug: string, webhookId: string, data: Partial<IWebhook>): Promise<IWebhook> {
    return toWebhook(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/webhooks/{pk}/", {
          params: webhookPath(workspaceSlug, webhookId),
          body: toWebhookUpdateBody(data),
        })
      )
    );
  }

  async deleteWebhook(workspaceSlug: string, webhookId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/webhooks/{pk}/", { params: webhookPath(workspaceSlug, webhookId) })
    );
  }

  async regenerateSecretKey(workspaceSlug: string, webhookId: string): Promise<IWebhook> {
    return toWebhook(
      await unwrap(
        apiClient.POST("/api/workspaces/{slug}/webhooks/{pk}/regenerate/", {
          params: webhookPath(workspaceSlug, webhookId),
        })
      )
    );
  }
}
