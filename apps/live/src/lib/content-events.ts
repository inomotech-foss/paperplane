/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Document, Hocuspocus } from "@hocuspocus/server";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import { z } from "zod";
import {
  CoreEditorExtensionsWithoutProps,
  DocumentEditorExtensionsWithoutProps,
  convertHTMLDocumentToAllFormats,
} from "@plane/editor/server";
import { logger } from "@plane/logger";
import type { HocusPocusServerContext } from "@/types";

/** The API publishes here when it writes a page body. Must match LIVE_CONTENT_CHANNEL in the API. */
export const CONTENT_CHANNEL = "paperplane:live-content";

const documentSchema = getSchema([...CoreEditorExtensionsWithoutProps, ...DocumentEditorExtensionsWithoutProps]);

const eventSchema = z.object({ id: z.string().min(1), page: z.string().min(1), html: z.string() });

type TContentEvent = z.infer<typeof eventSchema>;

const contextSchema = z.looseObject({
  documentType: z.literal("project_page"),
  cookie: z.string(),
  userId: z.string(),
  workspaceSlug: z.string().nullable(),
  projectId: z.string().nullable(),
});

/** Takes the event for this server. False when another server already applies it. */
export type TClaimContentEvent = (eventId: string) => Promise<boolean>;

const parseEvent = (message: string): TContentEvent | null => {
  try {
    const event = eventSchema.safeParse(JSON.parse(message));
    return event.success ? event.data : null;
  } catch {
    return null;
  }
};

const findDocument = (documents: Map<string, Document>, page: string): Document | undefined => {
  const name = page.toLowerCase();
  for (const document of documents.values()) {
    if (document.name.toLowerCase() === name) return document;
  }
  return undefined;
};

/** The save needs a user's credentials, so it borrows those of someone who has the page open. */
const contextOf = (document: Document): HocusPocusServerContext | null => {
  for (const connection of document.getConnections()) {
    const context = contextSchema.safeParse(connection.context);
    if (context.success) return context.data;
  }
  return null;
};

/**
 * Writes a body the API stored into the open document. Without this the document keeps the old body, and its next
 * save puts that back over the new one.
 *
 * The body is diffed into the document as an ordinary edit, so open editors receive it like a collaborator's change
 * and the save that follows stores it. Only a server that holds the page acts, and only the one that claims the event,
 * since two servers applying the same body would insert it twice once their changes merge.
 */
export const applyContentEvent = async (
  instance: Hocuspocus,
  message: string,
  claim: TClaimContentEvent
): Promise<boolean> => {
  const event = parseEvent(message);
  if (!event) {
    logger.warn(`Ignoring a malformed content event: ${message.slice(0, 200)}`);
    return false;
  }
  const document = findDocument(instance.documents, event.page);
  if (!document) return false;
  const context = contextOf(document);
  if (!context) {
    // An unloading document is saved with what it holds. The API dropped the binary, so a later load rebuilds it
    // from the HTML, unless that save lands after the API's write.
    logger.warn(`Page ${event.page} is open with no editor to save as, the API's body is not applied`);
    return false;
  }
  if (!(await claim(event.id))) return false;

  const { description_json } = convertHTMLDocumentToAllFormats({ document_html: event.html, variant: "document" });
  const direct = await instance.openDirectConnection(document.name, context);
  try {
    await direct.transact((doc) => {
      prosemirrorJSONToYXmlFragment(documentSchema, description_json, doc.getXmlFragment("default"));
    });
  } finally {
    await direct.disconnect();
  }
  logger.info(`Applied a body written through the API to open page ${event.page}`);
  return true;
};
