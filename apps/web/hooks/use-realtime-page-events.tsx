/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo, useRef } from "react";
// plane imports
import type { EventToPayloadMap } from "@plane/editor";
import { setToast } from "@plane/blocks/toast";
// types
import type { IUserLite } from "@plane/types";
// components
import type { TEditorBodyHandlers } from "@/components/pages/editor/editor-body";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

const getRealtimeErrorMessage = ({ error_type, error_code }: EventToPayloadMap["error"]) => {
  if (error_code === "content_too_large") return "Document is too large to save. Please reduce the content size.";
  if (error_code === "page_locked") return "The page is locked.";
  if (error_code === "page_archived") return "The page is archived.";
  return error_type === "fetch"
    ? "Unable to load the page. Please try refreshing."
    : "Unable to save the page. Please try again.";
};

// Type for page update handlers with proper typing for action data
export type PageUpdateHandler<T extends keyof EventToPayloadMap = keyof EventToPayloadMap> = (params: {
  pageIds: string[];
  data: EventToPayloadMap[T];
  performAction: boolean;
}) => void;

// Extra handlers that run after the default ones
export type TCustomEventHandlers = {
  [K in keyof EventToPayloadMap]?: PageUpdateHandler<K>;
};

interface UsePageEventsProps {
  page: TPageInstance;
  storeType: EPageStoreType;
  getUserDetails: (userId: string) => IUserLite | undefined;
  customRealtimeEventHandlers?: TCustomEventHandlers;
  handlers: TEditorBodyHandlers;
}

export const useRealtimePageEvents = ({
  page,
  storeType,
  getUserDetails,
  customRealtimeEventHandlers,
  handlers,
}: UsePageEventsProps) => {
  const router = useAppRouter();
  const { removePage, getPageById } = usePageStore(storeType);

  const { data: currentUser } = useUser();
  const saveErrorShownRef = useRef(false);

  // Helper function to safely get user display text
  const getUserDisplayText = useCallback(
    (userId: string | undefined) => {
      if (!userId) return "";
      try {
        const userDetails = getUserDetails(userId);
        return userDetails?.display_name ? ` by ${userDetails.display_name}` : "";
      } catch {
        return "";
      }
    },
    [getUserDetails]
  );

  const ACTION_HANDLERS = useMemo(
    function ACTION_HANDLERS(): TCustomEventHandlers {
      return {
        archived: ({ pageIds, data }: { pageIds: string[]; data: EventToPayloadMap["archived"] }) => {
          pageIds.forEach((pageId) => {
            const pageItem = getPageById(pageId);
            if (pageItem) pageItem.archive({ archived_at: data.archived_at, shouldSync: false });
          });
        },

        unarchived: ({ pageIds }: { pageIds: string[] }) => {
          pageIds.forEach((pageId) => {
            const pageItem = getPageById(pageId);
            if (pageItem) pageItem.restore({ shouldSync: false });
          });
        },

        locked: ({ pageIds }: { pageIds: string[] }) => {
          pageIds.forEach((pageId) => {
            const pageItem = getPageById(pageId);
            if (pageItem) pageItem.lock({ shouldSync: false, recursive: false });
          });
        },

        unlocked: ({ pageIds }: { pageIds: string[] }) => {
          pageIds.forEach((pageId) => {
            const pageItem = getPageById(pageId);
            if (pageItem) pageItem.unlock({ shouldSync: false, recursive: false });
          });
        },

        "made-public": ({ pageIds }: { pageIds: string[] }) => {
          pageIds.forEach((pageId) => {
            const pageItem = getPageById(pageId);
            if (pageItem) pageItem.makePublic({ shouldSync: false });
          });
        },

        "made-private": ({ pageIds }: { pageIds: string[] }) => {
          pageIds.forEach((pageId) => {
            const pageItem = getPageById(pageId);
            if (pageItem) pageItem.makePrivate({ shouldSync: false });
          });
        },

        deleted: ({ pageIds, data }: { pageIds: string[]; data: EventToPayloadMap["deleted"] }) => {
          pageIds.forEach((pageId) => {
            const pageItem = getPageById(pageId);
            if (pageItem) {
              removePage({ pageId, shouldSync: false });
              if (page.id === pageId && data?.user_id !== currentUser?.id) {
                setToast({
                  type: "error",
                  title: "Page deleted",
                  message: `Page deleted${getUserDisplayText(data.user_id)}`,
                });
                router.push(handlers.getRedirectionLink());
              } else if (page.id === pageId) {
                router.push(handlers.getRedirectionLink());
              }
            }
          });
        },

        property_updated: ({ pageIds, data }: { pageIds: string[]; data: EventToPayloadMap["property_updated"] }) => {
          // the open page's name belongs to its title editor; other pages, such as renamed children, take it
          pageIds.forEach((pageId) => getPageById(pageId)?.mutateProperties(data, pageId !== page.id));
          // a save went through, so the next failure is news again
          if (data.updated_at) saveErrorShownRef.current = false;
        },

        error: ({ pageIds, data }: { pageIds: string[]; data: EventToPayloadMap["error"] }) => {
          if (!page.id || !pageIds.includes(page.id)) return;
          if (data.error_type === "store") {
            // the server retries a failed save, so only the first failure in a row is shown
            if (saveErrorShownRef.current) return;
            saveErrorShownRef.current = true;
          }
          setToast({
            type: "error",
            title: data.error_type === "fetch" ? "Failed to load page" : "Failed to save page",
            message: getRealtimeErrorMessage(data),
          });
        },
      };
    },
    [getPageById, removePage, page, currentUser, getUserDisplayText, router, handlers]
  );

  // The main function that will be returned from this hook
  const updatePageProperties = useCallback(
    <T extends keyof EventToPayloadMap>(
      pageIds: string | string[],
      actionType: T,
      data: EventToPayloadMap[T],
      performAction = false
    ) => {
      // Convert to array if single string is passed
      const normalizedPageIds = Array.isArray(pageIds) ? pageIds : [pageIds];

      if (normalizedPageIds.length === 0) return;

      // Get the handler for this message type
      const handler = ACTION_HANDLERS[actionType];

      if (handler) {
        // Now TypeScript knows that handler and data match in type
        handler({ pageIds: normalizedPageIds, data, performAction });
      } else {
        console.warn(`No handler for message type: ${actionType.toString()}`);
      }
      customRealtimeEventHandlers?.[actionType]?.({ pageIds: normalizedPageIds, data, performAction });
    },
    [ACTION_HANDLERS, customRealtimeEventHandlers]
  );

  return { updatePageProperties };
};
