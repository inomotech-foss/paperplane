/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEditor as useTiptapEditor } from "@tiptap/react";
import { useImperativeHandle, useEffect } from "react";
import type { MarkdownStorage } from "tiptap-markdown";
// extensions
import { CoreEditorExtensions } from "@/extensions";
// helpers
import { getEditorRefHelpers } from "@/helpers/editor-ref";
// props
import { CoreEditorProps } from "@/props";
// types
import type { TEditorAsset, TEditorHookProps } from "@/types";

declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

export const useEditor = (props: TEditorHookProps) => {
  const {
    autofocus = false,
    disabledExtensions,
    editable = true,
    editorClassName = "",
    editorProps = {},
    enableHistory,
    extendedEditorProps,
    extensions = [],
    fileHandler,
    flaggedExtensions,
    forwardedRef,
    getEditorMetaData,
    handleEditorReady,
    id = "",
    initialValue,
    isTouchDevice,
    mentionHandler,
    onAssetChange,
    onChange,
    onEditorFocus,
    onTransaction,
    placeholder,
    showPlaceholderOnEmpty,
    tabIndex,
    provider,
    value,
  } = props;

  const editor = useTiptapEditor(
    {
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      autofocus,
      parseOptions: { preserveWhitespace: true },
      editorProps: {
        ...CoreEditorProps({
          editorClassName,
        }),
        ...editorProps,
      },
      extensions: [
        ...CoreEditorExtensions({
          disabledExtensions,
          editable,
          enableHistory,
          extendedEditorProps,
          fileHandler,
          flaggedExtensions,
          getEditorMetaData,
          isTouchDevice,
          mentionHandler,
          placeholder,
          showPlaceholderOnEmpty,
          tabIndex,
          provider,
        }),
        ...extensions,
      ],
      content: initialValue,
      onCreate: () => handleEditorReady?.(true),
      onTransaction: () => {
        onTransaction?.();
      },
      onUpdate: ({ editor: updatedEditor, transaction }) => {
        // Check if this update is only due to migration update
        const isMigrationUpdate = transaction?.getMeta("uniqueIdOnlyChange") === true;
        onChange?.(updatedEditor.getJSON(), updatedEditor.getHTML(), { isMigrationUpdate });
      },
      onDestroy: () => handleEditorReady?.(false),
      onFocus: onEditorFocus,
    },
    // A new provider brings a new Y.Doc, which the Collaboration extension only binds at creation
    [editable, provider]
  );

  // Effect for syncing SWR data
  useEffect(() => {
    // value is null when intentionally passed where syncing is not yet
    // supported and value is undefined when the data from swr is not populated
    if (value == null) return;
    if (editor) {
      const { uploadInProgress: isUploadInProgress } = editor.storage.utility;
      if (!editor.isDestroyed && !isUploadInProgress) {
        try {
          editor.commands.setContent(value, { emitUpdate: false, parseOptions: { preserveWhitespace: true } });
          if (editor.state.selection) {
            const docLength = editor.state.doc.content.size;
            const relativePosition = Math.min(editor.state.selection.from, docLength - 1);
            editor.commands.setTextSelection(relativePosition);
          }
        } catch (error) {
          console.error("Error syncing editor content with external value:", error);
        }
      }
    }
  }, [editor, value, id]);

  // update assets upload status
  useEffect(() => {
    if (!editor) return;
    const assetsUploadStatus = fileHandler.assetsUploadStatus;
    editor.commands.updateAssetsUploadStatus?.(assetsUploadStatus);
  }, [editor, fileHandler.assetsUploadStatus]);

  useEffect(() => {
    if (!editor || !onAssetChange) return;
    let reported: TEditorAsset[] | undefined;
    const reportAssets = () => {
      const assets = editor.storage.utility?.assetsList ?? [];
      if (assets === reported) return;
      reported = assets;
      onAssetChange(assets);
    };
    reportAssets();
    editor.on("transaction", reportAssets);
    return () => {
      editor.off("transaction", reportAssets);
    };
  }, [editor, onAssetChange]);

  useImperativeHandle(
    forwardedRef,
    () =>
      getEditorRefHelpers({
        editor,
        getEditorMetaData,
        provider,
      }),
    [editor, getEditorMetaData, provider]
  );

  if (!editor) {
    return null;
  }

  return editor;
};
