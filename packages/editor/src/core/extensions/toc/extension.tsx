/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// helpers
import { scrollSummary } from "@/helpers/scroll-to-node";
// types
import type { IMarking } from "@/types";
// local imports
import { DEFAULT_TOC_MAX_LEVEL, DEFAULT_TOC_MIN_LEVEL, TableOfContentsExtensionConfig } from "./extension-config";

const INDENT_BY_LEVEL: Record<number, string> = { 1: "pl-0", 2: "pl-3", 3: "pl-6", 4: "pl-9", 5: "pl-12", 6: "pl-14" };

function TableOfContents(props: NodeViewProps) {
  const { editor, node } = props;
  const [headings, setHeadings] = useState<IMarking[]>([]);

  const minLevel = Number(node.attrs["min-level"]) || DEFAULT_TOC_MIN_LEVEL;
  const maxLevel = Number(node.attrs["max-level"]) || DEFAULT_TOC_MAX_LEVEL;

  // HeadingListExtension recomputes its list inside appendTransaction and emits
  // an update, so following the editor's update event keeps this in step.
  useEffect(() => {
    const sync = () => setHeadings(editor.storage[CORE_EXTENSIONS.HEADINGS_LIST]?.headings ?? []);
    sync();
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor]);

  const visible = headings.filter((heading) => heading.level >= minLevel && heading.level <= maxLevel);

  return (
    <NodeViewWrapper className="toc-component my-2 block">
      <div contentEditable={false} className="rounded-md border border-subtle px-3 py-2">
        {visible.map((heading) => (
          <button
            key={`${heading.level}-${heading.sequence}`}
            type="button"
            onClick={() => scrollSummary(editor, heading)}
            className={`block w-full truncate py-0.5 text-left text-13 text-tertiary transition-colors hover:text-accent-primary ${INDENT_BY_LEVEL[heading.level] ?? "pl-0"}`}
          >
            {heading.text}
          </button>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export const TableOfContentsExtension = TableOfContentsExtensionConfig.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TableOfContents);
  },
});
