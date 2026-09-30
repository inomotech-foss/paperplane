/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Workflow } from "lucide-react";
// types
import type { TDiagramHandler, TDiagramSaveProps, TFileHandler } from "@/types";
// local imports
import { DiagramExtensionConfig } from "./extension-config";

type TDiagramOptions = {
  getAssetSrc: TFileHandler["getAssetSrc"] | undefined;
  renderEditor: TDiagramHandler["renderEditor"] | undefined;
};

function Diagram(props: NodeViewProps) {
  const { getAssetSrc, renderEditor } = props.extension.options as TDiagramOptions;
  const { asset_id: assetId, height, preview_asset_id: previewAssetId, title, width } = props.node.attrs;
  const [src, setSrc] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);
  const isEditable = renderEditor !== undefined && props.editor.isEditable;

  const handleSave = (saved: TDiagramSaveProps) => {
    props.updateAttributes(saved);
    setIsEditing(false);
    // The preview is a new asset, so the resolved source has to be dropped or
    // the node would keep showing the diagram as it looked before the edit.
    setSrc(undefined);
  };

  useEffect(() => {
    if (!previewAssetId || !getAssetSrc) return;
    let active = true;
    const resolve = async () => {
      try {
        const resolved = await getAssetSrc(previewAssetId);
        if (active) setSrc(resolved);
      } catch (error) {
        console.error("Error fetching diagram preview source:", error);
      }
    };
    void resolve();
    return () => {
      active = false;
    };
  }, [getAssetSrc, previewAssetId]);

  return (
    <NodeViewWrapper className="diagram-component my-2 block">
      <div
        contentEditable={false}
        onDoubleClick={isEditable ? () => setIsEditing(true) : undefined}
        className={isEditable ? "cursor-pointer" : undefined}
      >
        {src ? (
          <img
            src={src}
            alt={title ?? ""}
            width={width ?? undefined}
            height={height ?? undefined}
            className="h-auto max-w-full rounded-md"
          />
        ) : (
          // Either the preview is still resolving or the diagram was stored
          // without one; the title is all there is to show either way.
          <div className="flex items-center gap-2 rounded-md border border-subtle px-3 py-2 text-13 text-tertiary">
            <Workflow className="size-4 flex-shrink-0" />
            <span className="truncate">{title}</span>
          </div>
        )}
      </div>
      {isEditing &&
        renderEditor?.({
          assetId,
          title,
          onSave: handleSave,
          onClose: () => setIsEditing(false),
        })}
    </NodeViewWrapper>
  );
}

/**
 * The node stays registered even without a handler so a document editor that
 * cannot supply one still renders the diagram, just without editing.
 */
export function DiagramExtension(fileHandler: TFileHandler, handler: TDiagramHandler | undefined) {
  return DiagramExtensionConfig.extend<TDiagramOptions>({
    addOptions(this) {
      return {
        ...this.parent?.(),
        getAssetSrc: fileHandler.getAssetSrc,
        renderEditor: handler?.renderEditor,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(Diagram);
    },
  });
}
