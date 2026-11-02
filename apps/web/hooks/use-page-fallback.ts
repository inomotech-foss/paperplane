/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorRefApi, CollaborationState } from "@plane/editor";
// plane editor
import {
  convertBinaryDataToBase64String,
  getBinaryDataFromDocumentEditorHTMLString,
  hasChangesBeyond,
} from "@plane/editor";
// plane types
import { isApiError } from "@plane/services";
import type { TDocumentPayload } from "@plane/types";
// hooks
import useAutoSave from "@/hooks/use-auto-save";
import { isFallbackStage, isSyncTimeout } from "@/lib/collaboration-stage";
import type { TPageInstance } from "@/store/pages/base-page";

const RETRY_BASE_DELAY_MS = 30_000;
const RETRY_MAX_DELAY_MS = 5 * 60_000;

type TArgs = {
  editorRef: React.RefObject<Pick<
    EditorRefApi,
    "getDocument" | "isProviderDocumentEmpty" | "setProviderDocument"
  > | null>;
  fetchPageDescription: () => Promise<ArrayBuffer>;
  collaborationState: CollaborationState | null;
  updatePageDescription: (data: TDocumentPayload) => Promise<void>;
  page: Pick<TPageInstance, "description_html" | "isContentEditable" | "name">;
};

// Retrying cannot fix a 4xx such as a locked page or a missing permission.
const isPermanentFailure = (error: unknown): boolean => {
  if (!isApiError(error)) return false;
  const { status } = error;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
};

export const usePageFallback = (args: TArgs) => {
  const hasConnectionFailed = isFallbackStage(args.collaborationState);
  const isWaitingForSync = isSyncTimeout(args.collaborationState);

  const [isFetchingFallbackBinary, setIsFetchingFallbackBinary] = useState(false);

  // Runs read the latest args through a ref so that new identities do not trigger a run.
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  });

  const hasConnectionFailedRef = useRef(false);
  const generationRef = useRef(0);
  const isRunningRef = useRef(false);
  const isBlockedRef = useRef(false);
  const failureCountRef = useRef(0);
  const nextAttemptAtRef = useRef(0);

  const handleUpdateDescription = useCallback(async () => {
    if (!hasConnectionFailedRef.current || isRunningRef.current || isBlockedRef.current) return;
    if (Date.now() < nextAttemptAtRef.current) return;
    const { editorRef, fetchPageDescription, updatePageDescription } = argsRef.current;
    const editor = editorRef.current;
    if (!editor) return;

    const generation = generationRef.current;
    isRunningRef.current = true;
    setIsFetchingFallbackBinary(true);
    try {
      const latestEncodedDescription = await fetchPageDescription();
      const savedBinary =
        latestEncodedDescription && latestEncodedDescription.byteLength > 0
          ? new Uint8Array(latestEncodedDescription)
          : undefined;
      if (savedBinary) {
        editor.setProviderDocument(savedBinary);
      } else if (editor.isProviderDocumentEmpty()) {
        // A seed has its own client ID, so applying it to a non-empty doc would duplicate the content.
        const { page } = argsRef.current;
        editor.setProviderDocument(
          getBinaryDataFromDocumentEditorHTMLString(page.description_html ?? "<p></p>", page.name)
        );
      }

      if (!argsRef.current.page.isContentEditable) return;

      const { binary, html, json } = editor.getDocument();
      if (!binary || !json) return;
      // Every save queues version and activity tasks, so skip it when the stored page already has everything
      if (savedBinary && !hasChangesBeyond(binary, savedBinary)) return;
      await updatePageDescription({
        description_binary: convertBinaryDataToBase64String(binary),
        description_html: html,
        description_json: json,
      });
      failureCountRef.current = 0;
      nextAttemptAtRef.current = 0;
    } catch (error) {
      console.error(error);
      if (generation !== generationRef.current) return;
      if (isPermanentFailure(error)) {
        isBlockedRef.current = true;
      } else {
        failureCountRef.current += 1;
        nextAttemptAtRef.current =
          Date.now() + Math.min(RETRY_BASE_DELAY_MS * 2 ** failureCountRef.current, RETRY_MAX_DELAY_MS);
      }
    } finally {
      isRunningRef.current = false;
      setIsFetchingFallbackBinary(false);
    }
  }, []);

  useEffect(() => {
    hasConnectionFailedRef.current = hasConnectionFailed;
    generationRef.current += 1;
    isBlockedRef.current = false;
    failureCountRef.current = 0;
    nextAttemptAtRef.current = 0;
    if (!hasConnectionFailed) return;
    console.warn("Websocket Connection lost, your changes are being saved using backup mechanism.");
    void handleUpdateDescription();
  }, [handleUpdateDescription, hasConnectionFailed]);

  // Live may still hold newer edits, so the stored page is only merged into an empty doc and never saved
  const loadStoredPage = useCallback(async () => {
    const editor = argsRef.current.editorRef.current;
    if (!editor?.isProviderDocumentEmpty() || isRunningRef.current) return;
    isRunningRef.current = true;
    setIsFetchingFallbackBinary(true);
    try {
      const stored = await argsRef.current.fetchPageDescription();
      if (stored.byteLength > 0 && editor.isProviderDocumentEmpty()) editor.setProviderDocument(new Uint8Array(stored));
    } catch (error) {
      console.error(error);
    } finally {
      isRunningRef.current = false;
      setIsFetchingFallbackBinary(false);
    }
  }, []);

  useEffect(() => {
    if (isWaitingForSync) void loadStoredPage();
  }, [isWaitingForSync, loadStoredPage]);

  useAutoSave(handleUpdateDescription);

  return { isFetchingFallbackBinary };
};
