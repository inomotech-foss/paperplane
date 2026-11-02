// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect } from "react";
import type { EditorRefApi } from "@plane/editor";
import { parseRealtimePageEvent } from "@/lib/realtime-event";
import type { useRealtimePageEvents } from "@/hooks/use-realtime-page-events";

type TUpdatePageProperties = ReturnType<typeof useRealtimePageEvents>["updatePageProperties"];

/**
 * Applies the JSON page events the live server broadcasts for the open page, and renames of its
 * child pages. Bare event names are left to the page actions, and other events are ignored.
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
      if (!event) return;
      if (event.pageId === pageId) {
        // the open page's name comes from its title editor, never from a possibly stale broadcast
        if (event.action === "property_updated") {
          const { name: _name, ...saveDetails } = event.data;
          updatePageProperties(pageId, event.action, saveDetails);
        } else updatePageProperties(pageId, event.action, event.data);
        return;
      }
      if (event.parentPageId === pageId && event.action === "property_updated" && event.data.name !== undefined)
        updatePageProperties(event.pageId, event.action, { name: event.data.name });
    };
    listener.on("stateless", handleStatelessMessage);
    return () => listener.off("stateless", handleStatelessMessage);
  }, [editorRef, pageId, updatePageProperties]);
};
