/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// hocuspocus
import type { Extension, Hocuspocus, Document } from "@hocuspocus/server";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import type * as Y from "yjs";
// editor extensions
import {
  TITLE_EDITOR_EXTENSIONS,
  createRealtimeEvent,
  extractTextFromHTML,
  generateTitleProsemirrorJson,
} from "@plane/editor/server";
import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
// helpers
import type { TPageDetails } from "@/services/page/core.service";
import { getPageService } from "@/services/page/handler";
import type { HocusPocusServerContext, OnLoadDocumentPayloadWithContext } from "@/types";
import { broadcastMessageToPage } from "@/utils/broadcast-message";
import { TitleUpdateManager } from "./title-update/title-update-manager";

const titleSchema = getSchema(TITLE_EDITOR_EXTENSIONS);

/**
 * Hocuspocus extension for synchronizing document titles
 */
export class TitleSyncExtension implements Extension {
  // Maps document names to their observers and update managers
  private titleObservers: Map<string, (events: Y.YEvent<Y.AbstractType<unknown>>[]) => void> = new Map();
  private titleUpdateManagers: Map<string, TitleUpdateManager> = new Map();
  // Store minimal data needed for each document's title observer (prevents closure memory leaks)
  private titleObserverData: Map<
    string,
    {
      userId: string;
      workspaceSlug: string | null;
      projectId: string | null;
      instance: Hocuspocus;
    }
  > = new Map();
  // The page's parent, refreshed on every title save so a moved page reports to its new parent
  private parentIds: Map<string, string | null> = new Map();

  /**
   * Remember the parent page and migrate old titles if needed
   */
  async onLoadDocument({ context, document, documentName }: OnLoadDocumentPayloadWithContext) {
    try {
      const service = getPageService(context.documentType, context);
      const pageDetails = await service.fetchDetails(documentName);
      this.parentIds.set(documentName, pageDetails.parent ?? null);
      // on demand migration of old titles to the title field in the yjs binary
      if (document.isEmpty("title")) {
        const title = pageDetails.name;
        if (title == null) return;
        const titleJson = generateTitleProsemirrorJson(title);
        const titleField = prosemirrorJSONToYDoc(titleSchema, titleJson, "title");
        document.merge(titleField);
      }
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "onLoadDocument", documentName },
      });
      logger.error("Error loading document title", appError);
    }
  }
  /**
   * Set up title synchronization for a document after it's loaded
   */
  async afterLoadDocument({
    document,
    documentName,
    context,
    instance,
  }: {
    document: Document;
    documentName: string;
    context: HocusPocusServerContext;
    instance: Hocuspocus;
  }) {
    // Create a title update manager for this document
    const updateManager = new TitleUpdateManager(documentName, context, {
      onSaved: (page) => this.handleTitleSaved(documentName, page),
    });

    // Store the manager
    this.titleUpdateManagers.set(documentName, updateManager);

    // Store minimal data needed for the observer (prevents closure memory leak)
    this.titleObserverData.set(documentName, {
      userId: context.userId,
      workspaceSlug: context.workspaceSlug,
      projectId: context.projectId,
      instance: instance,
    });

    // Create observer using bound method to avoid closure capturing heavy objects
    const titleObserver = this.handleTitleChange.bind(this, documentName);

    // Observe the title field
    document.getXmlFragment("title").observeDeep(titleObserver);
    this.titleObservers.set(documentName, titleObserver);
  }

  /**
   * Handle title changes for a document
   * This is a separate method to avoid closure memory leaks
   */
  private handleTitleChange(documentName: string, events: Y.YEvent<Y.AbstractType<unknown>>[]) {
    let title = "";
    events.forEach((event) => {
      const html: unknown = event.currentTarget.toJSON();
      title = typeof html === "string" ? extractTextFromHTML(html) : "";
    });

    // Get the manager for this document
    const manager = this.titleUpdateManagers.get(documentName);

    this.broadcastToParent(documentName, title);

    // Schedule the title update
    if (manager) {
      manager.scheduleUpdate(title);
    }
  }

  // A page moved since it loaded reports to its new parent once the save returns it
  private handleTitleSaved(documentName: string, page: TPageDetails) {
    if (page.parent === undefined || !this.titleUpdateManagers.has(documentName)) return;
    const moved = page.parent !== this.parentIds.get(documentName);
    this.parentIds.set(documentName, page.parent);
    if (moved && page.name !== undefined) this.broadcastToParent(documentName, page.name);
  }

  // Clients with the parent page open show this page in their page tree
  private broadcastToParent(documentName: string, title: string) {
    const data = this.titleObserverData.get(documentName);
    const parentId = this.parentIds.get(documentName);
    if (!parentId || !data?.workspaceSlug) return;
    const event = createRealtimeEvent({
      user_id: data.userId,
      workspace_slug: data.workspaceSlug,
      project_id: data.projectId ?? undefined,
      action: "property_updated",
      page_id: documentName,
      parent_id: parentId,
      data: { name: title },
      descendants_ids: [],
    });
    void broadcastMessageToPage(data.instance, parentId, event);
  }

  /**
   * Force save title before unloading the document
   */
  async beforeUnloadDocument({ documentName }: { documentName: string }) {
    const updateManager = this.titleUpdateManagers.get(documentName);
    if (updateManager) {
      // Force immediate save and wait for it to complete
      await updateManager.forceSave();
      // Clean up the manager
      this.titleUpdateManagers.delete(documentName);
    }
  }

  /**
   * Remove observers after document unload
   */
  async afterUnloadDocument({ documentName, document }: { documentName: string; document?: Document }) {
    // Clean up observer when document is unloaded
    const observer = this.titleObservers.get(documentName);
    if (observer) {
      // unregister observer from Y.js document to prevent memory leak
      if (document) {
        try {
          document.getXmlFragment("title").unobserveDeep(observer);
        } catch (error) {
          logger.error("Failed to unobserve title field", new AppError(error, { context: { documentName } }));
        }
      }
      this.titleObservers.delete(documentName);
    }

    // Clean up the observer data map to prevent memory leak
    this.titleObserverData.delete(documentName);
    this.parentIds.delete(documentName);

    // Ensure manager is cleaned up if beforeUnloadDocument somehow didn't run
    const manager = this.titleUpdateManagers.get(documentName);
    if (manager) {
      manager.cancel();
      this.titleUpdateManagers.delete(documentName);
    }
  }
}
