/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
// plane editor imports
import { CoreEditorAdditionalExtensionsWithoutProps } from "@/plane-editor/extensions/core/without-props";
// extensions
import { CustomCalloutExtensionConfig } from "./callout/extension-config";
import { CustomCodeBlockExtensionWithoutProps } from "./code/without-props";
import { CommentMark } from "./comment/comment-mark";
import { CustomCodeInlineExtension } from "./code-inline";
import { AnchorExtensionConfig } from "./anchor/extension-config";
import { CustomColorExtension } from "./custom-color";
import { CustomImageExtensionConfig } from "./custom-image/extension-config";
import { CustomLinkExtension } from "./custom-link";
import { EmojiExtension } from "./emoji/extension";
import { CustomHorizontalRule } from "./horizontal-rule";
import { ImageExtensionConfig } from "./image/extension-config";
import { CustomMentionExtensionConfig } from "./mentions/extension-config";
import { CustomQuoteExtension } from "./quote";
import { CustomStarterKitExtension } from "./starter-kit";
import { Table } from "./table/table";
import { TableCell } from "./table/table-cell";
import { TableHeader } from "./table/table-header";
import { TableRow } from "./table/table-row";
import { CustomTextAlignExtension } from "./text-align";
import { TableOfContentsExtensionConfig } from "./toc/extension-config";
import { WorkItemEmbedExtensionConfig } from "./work-item-embed/extension-config";

export const CoreEditorExtensionsWithoutProps = [
  CustomStarterKitExtension({
    enableHistory: true,
  }),
  EmojiExtension,
  CustomQuoteExtension,
  CustomHorizontalRule,
  CustomLinkExtension,
  ImageExtensionConfig,
  CustomImageExtensionConfig,
  Underline,
  TextStyle,
  TaskList.configure({
    HTMLAttributes: {
      class: "not-prose pl-2 space-y-2",
    },
  }),
  TaskItem.configure({
    HTMLAttributes: {
      class: "flex",
    },
    nested: true,
  }),
  CustomCodeInlineExtension,
  CustomCodeBlockExtensionWithoutProps,
  Table,
  TableHeader,
  TableCell,
  TableRow,
  CustomMentionExtensionConfig,
  CustomTextAlignExtension,
  CustomCalloutExtensionConfig,
  CustomColorExtension,
  CommentMark,
  ...CoreEditorAdditionalExtensionsWithoutProps,
];

export const DocumentEditorExtensionsWithoutProps = [
  WorkItemEmbedExtensionConfig,
  AnchorExtensionConfig,
  TableOfContentsExtensionConfig,
];
