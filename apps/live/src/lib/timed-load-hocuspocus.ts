// SPDX-License-Identifier: AGPL-3.0-only

import { Hocuspocus } from "@hocuspocus/server";
import type { Configuration, Document } from "@hocuspocus/server";
import { logger } from "@plane/logger";

export const DOCUMENT_LOAD_TIMEOUT_REASON = "document-load-timeout";

// Hocuspocus sends `reason` to the waiting clients as the PermissionDenied reason.
export class DocumentLoadTimeoutError extends Error {
  readonly reason = DOCUMENT_LOAD_TIMEOUT_REASON;
}

/**
 * Hocuspocus shares one pending load between all clients of a document and authenticates them before the
 * load ends. A load that never settles would leave every client of the page connected but never synced.
 */
export class TimedLoadHocuspocus extends Hocuspocus {
  constructor(
    configuration: Partial<Configuration>,
    private readonly loadTimeoutMs: number
  ) {
    super(configuration);
  }

  override async loadDocument(...args: Parameters<Hocuspocus["loadDocument"]>): Promise<Document> {
    const [documentName] = args;
    const load = super.loadDocument(...args);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new DocumentLoadTimeoutError(`Loading ${documentName} took over ${this.loadTimeoutMs} ms`)),
        this.loadTimeoutMs
      );
    });
    try {
      return await Promise.race([load, timeout]);
    } catch (error) {
      if (error instanceof DocumentLoadTimeoutError) {
        logger.error(`HOCUSPOCUS: ${error.message}`);
        // The rejection removes the shared load, so the next client starts a new one. A late result is unused.
        load.then(
          (document) => document.destroy(),
          () => undefined
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
