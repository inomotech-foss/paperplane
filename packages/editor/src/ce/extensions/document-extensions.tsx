/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { AnyExtension } from "@tiptap/core";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import {
  AnchorExtensionConfig,
  ChildPagesExtension,
  ColumnExtensionConfig,
  ColumnsExtensionConfig,
  DiagramExtension,
  documentSlashCommandOptions,
  EmbedExtension,
  PageAttachmentsExtension,
  QueryBlockExtension,
  SlashCommands,
  TableOfContentsExtension,
  WorkItemEmbedExtension,
} from "@/extensions";
// types
import type { IEditorProps, TExtensions, TUserDetails } from "@/types";

export type TDocumentEditorAdditionalExtensionsProps = Pick<
  IEditorProps,
  | "childPagesHandler"
  | "diagramHandler"
  | "disabledExtensions"
  | "embedHandler"
  | "flaggedExtensions"
  | "fileHandler"
  | "pageAttachmentsHandler"
  | "queryBlockHandler"
  | "workItemEmbedHandler"
  | "extendedEditorProps"
> & {
  isEditable: boolean;
  provider?: HocuspocusProvider;
  userDetails: TUserDetails;
};

export type TDocumentEditorAdditionalExtensionsRegistry = {
  isEnabled: (disabledExtensions: TExtensions[], flaggedExtensions: TExtensions[]) => boolean;
  getExtension: (props: TDocumentEditorAdditionalExtensionsProps) => AnyExtension;
};

const extensionRegistry: TDocumentEditorAdditionalExtensionsRegistry[] = [
  {
    isEnabled: () => true,
    getExtension: () => AnchorExtensionConfig,
  },
  {
    isEnabled: () => true,
    getExtension: () => TableOfContentsExtension,
  },
  {
    isEnabled: () => true,
    getExtension: ({ childPagesHandler }) => ChildPagesExtension(childPagesHandler),
  },
  {
    isEnabled: () => true,
    getExtension: ({ diagramHandler, fileHandler }) => DiagramExtension(fileHandler, diagramHandler),
  },
  {
    isEnabled: () => true,
    getExtension: ({ pageAttachmentsHandler }) => PageAttachmentsExtension(pageAttachmentsHandler),
  },
  {
    isEnabled: () => true,
    getExtension: () => ColumnsExtensionConfig,
  },
  {
    isEnabled: () => true,
    getExtension: () => ColumnExtensionConfig,
  },
  {
    isEnabled: () => true,
    getExtension: ({ embedHandler }) => EmbedExtension(embedHandler),
  },
  {
    isEnabled: () => true,
    getExtension: ({ queryBlockHandler }) => QueryBlockExtension(queryBlockHandler),
  },
  {
    isEnabled: () => true,
    getExtension: ({ workItemEmbedHandler }) => WorkItemEmbedExtension(workItemEmbedHandler),
  },
  {
    isEnabled: (disabledExtensions) => !disabledExtensions.includes("slash-commands"),
    getExtension: ({ disabledExtensions, flaggedExtensions }) =>
      SlashCommands({ additionalOptions: documentSlashCommandOptions, disabledExtensions, flaggedExtensions }),
  },
  {
    isEnabled: () => true,
    getExtension: ({ provider, userDetails }) =>
      CollaborationCursor.configure({
        provider,
        user: {
          id: userDetails.id,
          name: userDetails.name,
          color: userDetails.color,
        },
      }),
  },
];

export function DocumentEditorAdditionalExtensions(props: TDocumentEditorAdditionalExtensionsProps) {
  const { disabledExtensions, flaggedExtensions } = props;

  const documentExtensions: AnyExtension[] = [];
  for (const config of extensionRegistry) {
    if (config.isEnabled(disabledExtensions, flaggedExtensions)) {
      documentExtensions.push(config.getExtension(props));
    }
  }

  return documentExtensions;
}
