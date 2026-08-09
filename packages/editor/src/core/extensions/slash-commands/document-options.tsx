/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ListTree, Network, Paperclip, Workflow } from "lucide-react";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// helpers
import { insertAtomBlock } from "@/helpers/editor-commands";
// local types
import type { TSlashCommandAdditionalOption } from "./root";

/**
 * Blocks that only exist in the document editor's schema. They are passed in as
 * additional options rather than added to the shared list so the rich-text
 * editor, whose schema has no such node, never offers a command that would
 * insert nothing.
 *
 * Each `pushAfter` names the entry before it, so they arrive as a group.
 */
export const documentSlashCommandOptions: TSlashCommandAdditionalOption[] = [
  {
    commandKey: "toc",
    key: "toc",
    title: "Table of contents",
    description: "Build an outline from this page's headings.",
    searchTerms: ["toc", "outline", "summary", "contents"],
    icon: <ListTree className="size-3.5" />,
    section: "general",
    pushAfter: "divider",
    command: ({ editor, range }) => insertAtomBlock(editor, CORE_EXTENSIONS.TABLE_OF_CONTENTS, range),
  },
  {
    commandKey: "child-pages",
    key: "child-pages",
    title: "Child pages",
    description: "List this page's sub-pages.",
    searchTerms: ["children", "sub-pages", "subpages", "tree"],
    icon: <Network className="size-3.5" />,
    section: "general",
    pushAfter: "toc",
    command: ({ editor, range }) => insertAtomBlock(editor, CORE_EXTENSIONS.CHILD_PAGES, range),
  },
  {
    commandKey: "diagram",
    key: "diagram",
    title: "Diagram",
    description: "Draw a diagram with draw.io.",
    searchTerms: ["drawio", "draw.io", "flowchart", "chart"],
    icon: <Workflow className="size-3.5" />,
    section: "general",
    pushAfter: "child-pages",
    command: ({ editor, range }) => insertAtomBlock(editor, CORE_EXTENSIONS.DIAGRAM, range),
  },
  {
    commandKey: "page-attachments",
    key: "page-attachments",
    title: "Attachments",
    description: "List the files attached to this page.",
    searchTerms: ["attachments", "files", "uploads"],
    icon: <Paperclip className="size-3.5" />,
    section: "general",
    pushAfter: "diagram",
    command: ({ editor, range }) => insertAtomBlock(editor, CORE_EXTENSIONS.PAGE_ATTACHMENTS, range),
  },
];
