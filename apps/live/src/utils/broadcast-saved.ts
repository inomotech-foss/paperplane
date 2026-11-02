/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Hocuspocus } from "@hocuspocus/server";
import { createRealtimeEvent } from "@plane/editor";
import type { HocusPocusServerContext } from "@/types";
import { broadcastMessageToPage } from "./broadcast-message";

/** Tells every open client who saved the page and when, so "Edited by" stays current. */
export const broadcastSaved = (
  hocuspocusServerInstance: Hocuspocus,
  pageId: string,
  context: HocusPocusServerContext
) =>
  broadcastMessageToPage(
    hocuspocusServerInstance,
    pageId,
    createRealtimeEvent({
      action: "property_updated",
      page_id: pageId,
      descendants_ids: [],
      data: { updated_by: context.userId, updated_at: new Date().toISOString(), user_id: context.userId },
      workspace_slug: context.workspaceSlug || "",
      project_id: context.projectId || undefined,
      user_id: context.userId,
    })
  );
