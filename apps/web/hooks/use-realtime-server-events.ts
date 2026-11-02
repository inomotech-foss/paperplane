// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect } from "react";
import type { EditorRefApi } from "@plane/editor";
import { parseRealtimePageEvent } from "@/lib/realtime-event";
import type { useRealtimePageEvents } from "@/hooks/use-realtime-page-events";

type TUpdatePageProperties = ReturnType<typeof useRealtimePageEvents>["updatePageProperties"];

/** Applies the JSON page events the live server broadcasts. Bare event names are left to the page actions. */
export const useRealtimeServerEvents = (
  editorRef: Pick<EditorRefApi, "listenToRealTimeUpdate"> | null,
  updatePageProperties: TUpdatePageProperties
) => {
  useEffect(() => {
    const listener = editorRef?.listenToRealTimeUpdate();
    if (!listener) return;
    const handleStatelessMessage = (message: { payload: string }) => {
      const event = parseRealtimePageEvent(message.payload);
      if (event?.action === "property_updated") updatePageProperties(event.pageIds, event.action, event.data);
      else if (event?.action === "error") updatePageProperties(event.pageIds, event.action, event.data);
    };
    listener.on("stateless", handleStatelessMessage);
    return () => listener.off("stateless", handleStatelessMessage);
  }, [editorRef, updatePageProperties]);
};
