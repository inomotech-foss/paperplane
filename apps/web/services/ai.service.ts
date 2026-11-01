/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TWritingTask = ApiSchema<"WritingTaskRequest">;

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class AIService {
  /** Runs a writing task and returns the result as sanitized HTML. */
  async runWritingTask(workspaceSlug: string, task: TWritingTask, signal?: AbortSignal): Promise<string> {
    const { html } = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/writing-assistant/", {
        params: { path: { slug: workspaceSlug } },
        body: task,
        signal,
      })
    );
    return html;
  }
}
