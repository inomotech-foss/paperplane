/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
import type { TPageDetails } from "@/services/page/core.service";
import { getPageService } from "@/services/page/handler";
import type { HocusPocusServerContext } from "@/types";
import { DebounceManager } from "./debounce";

/**
 * Manages title update operations for a single document
 * Handles debouncing, aborting, and force saving title updates
 */
export class TitleUpdateManager {
  private documentName: string;
  private context: HocusPocusServerContext;
  private debounceManager: DebounceManager<[title: string]>;
  private lastTitle: string | null = null;
  private onSaved?: (page: TPageDetails) => void;

  constructor(
    documentName: string,
    context: HocusPocusServerContext,
    options: { wait?: number; onSaved?: (page: TPageDetails) => void } = {}
  ) {
    const { wait = 5000, onSaved } = options;
    this.documentName = documentName;
    this.context = context;
    this.onSaved = onSaved;

    // Set up debounce manager with logging
    this.debounceManager = new DebounceManager({
      wait,
      logPrefix: `TitleManager[${documentName.substring(0, 8)}]`,
    });
  }

  /**
   * Schedule a debounced title update
   */
  scheduleUpdate(title: string): void {
    // Store the latest title
    this.lastTitle = title;

    // Schedule the update with the debounce manager
    this.debounceManager.schedule(this.updateTitle.bind(this), title);
  }

  /**
   * Update the title - will be called by the debounce manager
   */
  private async updateTitle(title: string, signal?: AbortSignal): Promise<void> {
    const service = getPageService(this.context.documentType, this.context);
    if (!service.updatePageProperties) {
      logger.warn(`No updateTitle method found for document ${this.documentName}`);
      return;
    }

    try {
      const page = await service.updatePageProperties(this.documentName, {
        data: { name: title },
        abortSignal: signal,
      });
      this.onSaved?.(page);

      // Clear last title only if it matches what we just updated
      if (this.lastTitle === title) {
        this.lastTitle = null;
      }
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "updateTitle", documentName: this.documentName },
      });
      logger.error("Error updating title", appError);
    }
  }

  /**
   * Force save the current title immediately
   */
  async forceSave(): Promise<void> {
    // Ensure we have the current title
    if (!this.lastTitle) {
      return;
    }

    // Use the debounce manager to flush the operation
    await this.debounceManager.flush(this.updateTitle.bind(this));
  }

  /**
   * Cancel any pending updates
   */
  cancel(): void {
    this.debounceManager.cancel();
    this.lastTitle = null;
  }
}
