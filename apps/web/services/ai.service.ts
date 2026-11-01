/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import type { AI_EDITOR_TASKS } from "@plane/constants";
import { unwrap } from "@plane/services";
import { getStringField } from "@/helpers/narrow.helper";
import { apiClient } from "@/services/api-client";
import { sendJson } from "@/services/send-json";

export type TTaskPayload = {
  casual_score?: number;
  formal_score?: number;
  task: AI_EDITOR_TASKS;
  text_input: string;
};

/** The reply of the editor task endpoint, which the schema does not describe. */
export function parseEditorTaskReply(data: unknown): { response: string } {
  const response = getStringField(data, "response");
  if (response === undefined) throw new Error("The editor task returned no response");
  return { response };
}

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class AIService {
  async createGptTask(
    workspaceSlug: string,
    data: { prompt: string; task: string }
  ): Promise<ApiSchema<"AssistantReply">> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/ai-assistant/", { params: { path: { slug: workspaceSlug } }, body: data })
    );
  }

  /** The route is not part of the API schema, so the request goes through `sendJson`. */
  async performEditorTask(workspaceSlug: string, data: TTaskPayload): Promise<{ response: string }> {
    return parseEditorTaskReply(await sendJson(`/api/workspaces/${workspaceSlug}/rephrase-grammar/`, data));
  }
}
