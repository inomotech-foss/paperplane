// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect } from "react";
import type { EditorRefApi } from "@plane/editor";
import { parseRealtimePageEvent } from "@/lib/realtime-event";
import type { useRealtimePageEvents } from "@/hooks/use-realtime-page-events";

type TUpdatePageProperties = ReturnType<typeof useRealtimePageEvents>["updatePageProperties"];

/**
 * Applies the JSON page events the live server broadcasts for the open page. Bare event names are
 * left to the page actions, and events about any other page are ignored.
 */
export const useRealtimeServerEvents = (
  editorRef: Pick<EditorRefApi, "listenToRealTimeUpdate"> | null,
  pageId: string | undefined,
  updatePageProperties: TUpdatePageProperties
) => {
  useEffect(() => {
    const listener = editorRef?.listenToRealTimeUpdate();
    if (!listener || !pageId) return;
    const handleStatelessMessage = (message: { payload: string }) => {
      const event = parseRealtimePageEvent(message.payload);
      if (!event || event.pageId !== pageId) return;
      if (event.action === "property_updated") updatePageProperties(pageId, event.action, event.data);
      else updatePageProperties(pageId, event.action, event.data);
    };
    listener.on("stateless", handleStatelessMessage);
    return () => listener.off("stateless", handleStatelessMessage);
  }, [editorRef, pageId, updatePageProperties]);
};
