// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import type { CollaborationState } from "@plane/editor";
import { isFallbackStage } from "@/lib/collaboration-stage";

/** Asks before the tab closes while edits exist only in this browser. The fallback save covers its own stages. */
export const useUnsyncedChangesPrompt = (state: CollaborationState | null) => {
  const shouldPrompt = state?.hasUnsyncedChanges === true && !isFallbackStage(state);

  useEffect(() => {
    if (!shouldPrompt) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldPrompt]);
};
