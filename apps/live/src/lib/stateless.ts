/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { onStatelessPayload } from "@hocuspocus/server";
import { DocumentCollaborativeEvents } from "@plane/editor/lib";
import { isKeyOf } from "@/lib/is-key-of";
import { refreshConnectionAccess } from "@/lib/page-access";

// Events after which a viewer's access to the page may differ.
const ACCESS_EVENTS = new Set<keyof typeof DocumentCollaborativeEvents>([
  "lock",
  "unlock",
  "archive",
  "unarchive",
  "make-public",
  "make-private",
]);

/**
 * Broadcast the client event to all the clients so that they can update their state.
 * Only editors may send events. A read-only sender is re-checked first, since it may have just unlocked or
 * restored the page.
 */
export const onStateless = async ({ payload, document, connection }: onStatelessPayload) => {
  if (!isKeyOf(DocumentCollaborativeEvents, payload)) return;
  if (connection.readOnly && !(await refreshConnectionAccess(connection))) return;

  document.broadcastStateless(DocumentCollaborativeEvents[payload].client);

  if (ACCESS_EVENTS.has(payload)) {
    await Promise.all(document.getConnections().map(refreshConnectionAccess));
  }
};
