/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Connection, Document } from "@hocuspocus/server";
import { z } from "zod";
import { logger } from "@plane/logger";
import { recheckConnectionAccess } from "@/lib/page-access";

/** The API publishes here when page access may have changed. Must match LIVE_ACCESS_CHANNEL in the API. */
export const ACCESS_CHANNEL = "paperplane:live-access";

const id = z.string().min(1).toLowerCase();

const eventSchema = z
  .object({ page: id.optional(), project: id.optional(), user: id.optional() })
  .refine((event) => event.page !== undefined || event.project !== undefined || event.user !== undefined);

type TAccessEvent = z.infer<typeof eventSchema>;

const contextSchema = z.looseObject({ userId: z.string(), projectId: z.string().nullable() });

const parseEvent = (message: string): TAccessEvent | null => {
  try {
    const event = eventSchema.safeParse(JSON.parse(message));
    return event.success ? event.data : null;
  } catch {
    return null;
  }
};

/** A connection without a readable context is re-checked, which closes it. */
const isAffected = (connection: Connection, event: TAccessEvent): boolean => {
  const context = contextSchema.safeParse(connection.context);
  if (!context.success) return true;
  if (event.user !== undefined && context.data.userId.toLowerCase() !== event.user) return false;
  if (event.project !== undefined && context.data.projectId?.toLowerCase() !== event.project) return false;
  return true;
};

/**
 * Re-checks the open connections that match every id in the event. The event only selects connections, the API
 * decides their access.
 */
export const recheckAffectedConnections = async (documents: Map<string, Document>, message: string): Promise<void> => {
  const event = parseEvent(message);
  if (!event) {
    logger.warn(`Ignoring a malformed access event: ${message.slice(0, 200)}`);
    return;
  }
  const checks: Promise<boolean>[] = [];
  for (const document of documents.values()) {
    if (event.page !== undefined && document.name.toLowerCase() !== event.page) continue;
    for (const connection of document.getConnections()) {
      if (isAffected(connection, event)) checks.push(recheckConnectionAccess(connection));
    }
  }
  await Promise.allSettled(checks);
};
