/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
// plane imports
import { CORE_EXTENSIONS } from "@plane/utils";
// helpers
import { CORE_ASSETS_META_DATA_RECORD } from "@/helpers/assets";
import { readString } from "@plane/types";
// plane editor imports
import { NODE_FILE_MAP } from "@/constants/utility";
// types
import type { TFileHandler } from "@/types";
// local imports
import type { TFileNode } from "./types";
import { getFileNodeType } from "./types";

const RESTORE_PLUGIN_KEY = new PluginKey("restore-utility");

export const TrackFileRestorationPlugin = (editor: Editor, restoreHandler: TFileHandler["restore"]): Plugin =>
  new Plugin({
    key: RESTORE_PLUGIN_KEY,
    appendTransaction: (transactions: readonly Transaction[], oldState: EditorState, newState: EditorState) => {
      if (!transactions.some((tr) => tr.docChanged)) return null;

      const oldFileSources: {
        [key: string]: Set<unknown> | undefined;
      } = {};
      oldState.doc.descendants((node) => {
        const nodeType = getFileNodeType(node);
        const nodeFileSetDetails = nodeType && NODE_FILE_MAP[nodeType];
        if (nodeType && nodeFileSetDetails) {
          const src: unknown = node.attrs.src;
          if (oldFileSources[nodeType]) {
            oldFileSources[nodeType].add(src);
          } else {
            oldFileSources[nodeType] = new Set([src]);
          }
        }
      });

      transactions.forEach(() => {
        const addedFiles: TFileNode[] = [];

        newState.doc.descendants((node, pos) => {
          const nodeType = getFileNodeType(node);
          // if the node doesn't match, then return as no point in checking
          if (!nodeType || !NODE_FILE_MAP[nodeType]) return;
          if (pos < 0 || pos > newState.doc.content.size) return;
          const src: unknown = node.attrs.src;
          if (oldFileSources[nodeType]?.has(src)) return;
          // update assets list storage value
          const assetMetaData = CORE_ASSETS_META_DATA_RECORD[nodeType]?.(node.attrs);
          if (assetMetaData) {
            editor.commands.updateAssetsList?.({
              asset: assetMetaData,
            });
          }
          // if the src is just a id (private bucket), then we don't need to handle restore from here but
          // only while it fails to load
          const httpSrc = readString(node.attrs, "src")?.startsWith("http");
          if (nodeType === CORE_EXTENSIONS.CUSTOM_IMAGE && !httpSrc) return;
          if (typeof src === "string") addedFiles.push({ node, nodeType, src });
        });

        addedFiles.forEach(async ({ nodeType, src }) => {
          const nodeFileSetDetails = NODE_FILE_MAP[nodeType];
          if (!nodeFileSetDetails) return;
          const extensionFileSetStorage = editor.storage[nodeType]?.[nodeFileSetDetails.fileSetName];
          const wasDeleted = extensionFileSetStorage?.get(src);
          if (!nodeFileSetDetails || !src) return;
          if (wasDeleted === undefined) {
            extensionFileSetStorage?.set(src, false);
          } else if (wasDeleted === true) {
            try {
              await restoreHandler(src);
              extensionFileSetStorage?.set(src, false);
            } catch (error) {
              console.error("Error restoring file via restore utility plugin:", error);
            }
          }
        });
      });
      return null;
    },
  });
