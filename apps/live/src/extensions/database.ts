/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Database as HocuspocusDatabase } from "@hocuspocus/extension-database";
// plane imports
import {
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  getBinaryDataFromDocumentEditorHTMLString,
} from "@plane/editor/server";
import type { TDocumentPayload } from "@plane/types";
import { logger } from "@plane/logger";
// lib
import { DocumentLoadTimeoutError } from "@/lib/document-load-timeout";
import { AppError } from "@/lib/errors";
// services
import { getPageService } from "@/services/page/handler";
// type
import type { FetchPayloadWithContext, StorePayloadWithContext } from "@/types";
import { ForceCloseReason, CloseCode } from "@/types/admin-commands";
import { broadcastError } from "@/utils/broadcast-error";
import { broadcastSaved } from "@/utils/broadcast-saved";
// force close utility
import { forceCloseDocumentAcrossServers } from "./force-close-handler";

const DEFAULT_LOAD_TIMEOUT_MS = 30_000;

type TPageService = ReturnType<typeof getPageService>;

const fetchBinary = async (service: TPageService, pageId: string, signal: AbortSignal) => {
  const response = await service.fetchDescriptionBinary(pageId, signal);
  const binaryData = new Uint8Array(response);
  if (binaryData.byteLength > 0) return binaryData;

  // if binary data is empty, convert HTML to binary data
  const pageDetails = await service.fetchDetails(pageId, signal);
  const convertedBinaryData = getBinaryDataFromDocumentEditorHTMLString(
    pageDetails.description_html ?? "<p></p>",
    pageDetails.name
  );
  if (!convertedBinaryData) return binaryData;
  // save the converted binary data back to the database
  try {
    const { contentBinaryEncoded, contentHTML, contentJSON } = getAllDocumentFormatsFromDocumentEditorBinaryData(
      convertedBinaryData,
      true
    );
    const payload: TDocumentPayload = {
      description_binary: contentBinaryEncoded,
      description_html: contentHTML,
      description_json: contentJSON,
    };
    await service.updateDescriptionBinary(pageId, payload, signal);
  } catch (e) {
    const error = new AppError(e);
    logger.error("Failed to save binary after first conversion from html:", error);
  }
  return convertedBinaryData;
};

const fetchDocument = async (
  { context, documentName: pageId, instance }: FetchPayloadWithContext,
  loadTimeoutMs: number
) => {
  // One deadline for the whole fetch. The load then fails while it is still the pending one, so no
  // replacement document exists that a late result could disturb.
  const signal = AbortSignal.timeout(loadTimeoutMs);
  const deadline = new Promise<never>((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new DocumentLoadTimeoutError(`Loading ${pageId} took over ${loadTimeoutMs} ms`)),
      { once: true }
    );
  });
  try {
    const service = getPageService(context.documentType, context);
    return await Promise.race([fetchBinary(service, pageId, signal), deadline]);
  } catch (error) {
    if (error instanceof DocumentLoadTimeoutError) {
      logger.error("Error in fetching document", new AppError(error, { context: { pageId } }));
      throw error;
    }
    const appError = new AppError(error, { context: { pageId } });
    logger.error("Error in fetching document", appError);

    // Broadcast error to frontend for user document types
    await broadcastError(instance, pageId, "Unable to load the page. Please try refreshing.", "fetch", context);

    throw appError;
  }
};

const storeDocument = async (data: StorePayloadWithContext) => {
  const { context, state: pageBinaryData, documentName: pageId, instance } = data;
  try {
    const service = getPageService(context.documentType, context);
    // convert binary data to all formats
    const { contentBinaryEncoded, contentHTML, contentJSON } = getAllDocumentFormatsFromDocumentEditorBinaryData(
      pageBinaryData,
      true
    );
    // create payload
    const payload: TDocumentPayload = {
      description_binary: contentBinaryEncoded,
      description_html: contentHTML,
      description_json: contentJSON,
    };
    await service.updateDescriptionBinary(pageId, payload);
    if (context.userId) void broadcastSaved(instance, pageId, context);
  } catch (error) {
    const appError = new AppError(error, { context: { pageId } });
    logger.error("Error in updating document:", appError);

    // Check error types
    const isContentTooLarge = appError.statusCode === 413;

    // Determine if we should disconnect and unload
    const shouldDisconnect = isContentTooLarge;

    // Determine error message and code
    let errorMessage: string;
    let errorCode: "content_too_large" | "page_locked" | "page_archived" | undefined;

    if (isContentTooLarge) {
      errorMessage = "Document is too large to save. Please reduce the content size.";
      errorCode = "content_too_large";
    } else {
      errorMessage = "Unable to save the page. Please try again.";
    }

    // Broadcast error to frontend for user document types
    await broadcastError(instance, pageId, errorMessage, "store", context, errorCode, shouldDisconnect);

    // If we should disconnect, close connections and unload document
    if (shouldDisconnect) {
      // Map error code to ForceCloseReason with proper types
      const reason =
        errorCode === "content_too_large" ? ForceCloseReason.DOCUMENT_TOO_LARGE : ForceCloseReason.CRITICAL_ERROR;

      const closeCode = errorCode === "content_too_large" ? CloseCode.DOCUMENT_TOO_LARGE : CloseCode.FORCE_CLOSE;

      // force close connections and unload document
      await forceCloseDocumentAcrossServers(instance, pageId, reason, closeCode);

      // Don't throw after force close - document is already unloaded
      // Throwing would cause hocuspocus's finally block to access the null document
      return;
    }

    // Hocuspocus keeps a rejected save as the running one, which would block every later save of this page.
    // Schedule another save instead, unless the API rejected the content itself.
    const isTransient = appError.statusCode === undefined || appError.statusCode >= 500;
    if (isTransient) void instance.storeDocumentHooks(data.document, data);
  }
};

export class Database extends HocuspocusDatabase {
  constructor({ loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS }: { loadTimeoutMs?: number } = {}) {
    super({ fetch: (data: FetchPayloadWithContext) => fetchDocument(data, loadTimeoutMs), store: storeDocument });
  }
}
