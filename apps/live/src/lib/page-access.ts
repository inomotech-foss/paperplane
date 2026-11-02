/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Connection } from "@hocuspocus/server";
import { z } from "zod";
import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
import { PageAccessService } from "@/services/page-access.service";

const contextSchema = z.looseObject({
  cookie: z.string(),
  workspaceSlug: z.string().nullable(),
  projectId: z.string().nullable(),
});

/**
 * Re-reads the user's page access and applies it to the connection: read-only on "read" or a failed check,
 * closed when the user lost access. Returns whether the connection may edit.
 */
export const refreshConnectionAccess = async (connection: Connection): Promise<boolean> => {
  const context = contextSchema.safeParse(connection.context);
  if (!context.success) {
    connection.readOnly = true;
    return false;
  }
  try {
    const access = await new PageAccessService().fetchAccess({ ...context.data, pageId: connection.document.name });
    connection.readOnly = access === "read";
  } catch (error) {
    connection.readOnly = true;
    const appError = new AppError(error, { context: { operation: "refreshConnectionAccess" } });
    if (appError.statusCode === 403 || appError.statusCode === 404) {
      connection.close({ code: 4403, reason: "Forbidden" });
    } else {
      logger.error("Page access re-check failed", appError);
    }
  }
  return !connection.readOnly;
};
