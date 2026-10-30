/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { onStatelessPayload } from "@hocuspocus/server";
import { DocumentCollaborativeEvents } from "@plane/editor/lib";
import { isKeyOf } from "@/lib/is-key-of";

/**
 * Broadcast the client event to all the clients so that they can update their state
 * @param param0
 */
export const onStateless = async ({ payload, document }: onStatelessPayload) => {
  const response = isKeyOf(DocumentCollaborativeEvents, payload)
    ? DocumentCollaborativeEvents[payload].client
    : undefined;
  if (response) {
    document.broadcastStateless(response);
  }
};
