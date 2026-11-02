// SPDX-License-Identifier: AGPL-3.0-only

import type { CollaborationState } from "@plane/editor";

/** The page cannot sync yet but is still reconnecting. Its edits are kept locally until live is back. */
export const isSyncTimeout = (state: CollaborationState | null): boolean =>
  state?.stage.kind === "disconnected" && state.stage.error.type === "sync-timeout";

/**
 * Live has stopped for good, so the page saves over HTTP. That save overwrites the stored page, which is not
 * safe while live may still hold or later store other edits.
 */
export const isFallbackStage = (state: CollaborationState | null): boolean =>
  state?.stage.kind === "disconnected" && !isSyncTimeout(state);
