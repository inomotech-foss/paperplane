/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
// constants
import { CORE_EDITOR_META } from "@/constants/meta";
// plane editor imports
import { NODE_FILE_MAP } from "@/constants/utility";
// helpers
import { readString } from "@plane/types";
// types
import type { TFileHandler } from "@/types";
// local imports
import type { TFileNode } from "./types";
import { getFileNodeType } from "./types";

const DELETE_PLUGIN_KEY = new PluginKey("delete-utility");

export const TrackFileDeletionPlugin = (editor: Editor, deleteHandler: TFileHandler["delete"]): Plugin =>
  new Plugin({
    key: DELETE_PLUGIN_KEY,
    appendTransaction: (transactions: readonly Transaction[], oldState: EditorState, newState: EditorState) => {
      const newFileSources: {
        [nodeType: string]: Set<unknown> | undefined;
      } = {};
      if (!transactions.some((tr) => tr.docChanged)) return null;
      if (transactions.some((tr) => tr.getMeta(CORE_EDITOR_META.SKIP_FILE_DELETION))) return null;

      newState.doc.descendants((node) => {
        const nodeType = getFileNodeType(node);
        const nodeFileSetDetails = nodeType && NODE_FILE_MAP[nodeType];
        if (nodeType && nodeFileSetDetails) {
          const src: unknown = node.attrs.src;
          if (newFileSources[nodeType]) {
            newFileSources[nodeType].add(src);
          } else {
            newFileSources[nodeType] = new Set([src]);
          }
        }
      });

      const removedFiles: TFileNode[] = [];

      // iterate through all the nodes in the old state
      oldState.doc.descendants((node) => {
        const nodeType = getFileNodeType(node);
        // if the node doesn't match, then return as no point in checking
        if (!nodeType || !NODE_FILE_MAP[nodeType]) return;
        const src: unknown = node.attrs.src;
        // Check if the node has been deleted or replaced
        if (!newFileSources[nodeType]?.has(src) && typeof src === "string") {
          removedFiles.push({ node, nodeType, src });
        }
      });

      removedFiles.forEach(async ({ node, nodeType, src }) => {
        const nodeFileSetDetails = NODE_FILE_MAP[nodeType];
        if (!nodeFileSetDetails || !src) return;
        try {
          editor.storage[nodeType]?.[nodeFileSetDetails.fileSetName]?.set(src, true);
          // update assets list storage value
          editor.commands.updateAssetsList?.({
            idToRemove: readString(node.attrs, "id") ?? "",
          });
          await deleteHandler(src);
        } catch (error) {
          console.error("Error deleting file via delete utility plugin:", error);
        }
      });

      return null;
    },
  });
