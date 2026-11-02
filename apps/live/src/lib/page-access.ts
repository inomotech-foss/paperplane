/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Connection, Document } from "@hocuspocus/server";
import { z } from "zod";
import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
import { PageAccessService } from "@/services/page-access.service";
import type { TPageAccess } from "@/services/page-access.service";

const contextSchema = z.looseObject({
  cookie: z.string(),
  workspaceSlug: z.string().nullable(),
  projectId: z.string().nullable(),
});

type TAccessOutcome = TPageAccess | "denied" | "unavailable";

/** Whether the API refused the user, as opposed to failing to answer. */
export const isAccessDenied = (error: AppError): boolean =>
  error.statusCode === 401 ||
  error.statusCode === 403 ||
  error.statusCode === 404 ||
  error.code === "PAGE_ACCESS_INVALID_TARGET";

const fetchOutcome = async (connection: Connection): Promise<TAccessOutcome> => {
  const context = contextSchema.safeParse(connection.context);
  if (!context.success) return "denied";
  try {
    return await new PageAccessService().fetchAccess({ ...context.data, pageId: connection.document.name });
  } catch (error) {
    const appError = new AppError(error, { context: { operation: "recheckConnectionAccess" } });
    if (isAccessDenied(appError)) {
      logger.warn("Page access revoked", appError);
      return "denied";
    }
    logger.error("Page access re-check failed", appError);
    return "unavailable";
  }
};

/**
 * Hocuspocus does not tell a client when `readOnly` changes, so its edits would be dropped without notice.
 * A changed access level closes the connection instead, and the client reconnects with the right mode.
 */
const applyOutcome = (connection: Connection, outcome: TAccessOutcome): boolean => {
  if (!connection.document.hasConnection(connection)) return false;
  if (outcome === "unavailable") return !connection.readOnly;
  if (outcome === "denied") {
    connection.close({ code: 4403, reason: "Forbidden" });
    return false;
  }
  if ((outcome === "read") !== connection.readOnly) {
    connection.close({ code: 4409, reason: "Access changed" });
  }
  return outcome === "edit";
};

type TCoalesced<T> = { generation: number; running: Promise<T> | null };

/**
 * Runs `task` once for any number of calls that arrive while it runs, plus once more if calls arrived during the
 * run. A result is only applied when no newer call came in while it was in flight. Every caller gets the result
 * that was applied.
 */
const coalesce = <K extends WeakKey, T>(
  states: WeakMap<K, TCoalesced<T>>,
  key: K,
  task: () => Promise<() => T>
): Promise<T> => {
  const state = states.get(key) ?? { generation: 0, running: null };
  states.set(key, state);
  state.generation++;
  const run = async (): Promise<T> => {
    const generation = state.generation;
    const apply = await task();
    if (generation !== state.generation) return run();
    state.running = null;
    return apply();
  };
  state.running ??= run().catch((error: unknown) => {
    state.running = null;
    throw error;
  });
  return state.running;
};

const connectionChecks = new WeakMap<Connection, TCoalesced<boolean>>();
const documentChecks = new WeakMap<Document, TCoalesced<void>>();

/**
 * Re-reads the user's page access. Closes the connection when access is gone or its level changed, and keeps it
 * as it is when the API does not answer. Returns whether the user may edit.
 */
export const recheckConnectionAccess = (connection: Connection): Promise<boolean> =>
  coalesce(connectionChecks, connection, async () => {
    const outcome = await fetchOutcome(connection);
    return () => applyOutcome(connection, outcome);
  });

/** Re-checks every connection to the document. */
export const recheckDocumentAccess = (document: Document): Promise<void> =>
  coalesce(documentChecks, document, async () => {
    await Promise.all(document.getConnections().map(recheckConnectionAccess));
    return () => undefined;
  });
