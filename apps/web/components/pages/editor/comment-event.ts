/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { readString } from "@plane/types";

/** Reads the thread id from the editor's comment-create event. */
export const getCommentEventThreadId = (event: Event): string | undefined =>
  event instanceof CustomEvent ? readString(event.detail, "threadId") : undefined;
