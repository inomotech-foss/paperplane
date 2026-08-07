/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Workflow } from "lucide-react";
// types
import type { TFileHandler } from "@/types";
// local imports
import { DiagramExtensionConfig } from "./extension-config";

type TDiagramOptions = {
  getAssetSrc: TFileHandler["getAssetSrc"] | undefined;
};

function Diagram(props: NodeViewProps) {
  const { getAssetSrc } = props.extension.options as TDiagramOptions;
  const { height, preview_asset_id: previewAssetId, title, width } = props.node.attrs;
  const [src, setSrc] = useState<string>();

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
      <div contentEditable={false}>
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
    </NodeViewWrapper>
  );
}

export function DiagramExtension(fileHandler: TFileHandler) {
  return DiagramExtensionConfig.extend<TDiagramOptions>({
    addOptions(this) {
      return {
        ...this.parent?.(),
        getAssetSrc: fileHandler.getAssetSrc,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(Diagram);
    },
  });
}
