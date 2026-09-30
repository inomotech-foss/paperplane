/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { CircleArrowUp } from "lucide-react";
import { AiStar1Outline } from "@makeplane/propel/icons";
// ui
// components
import { cn } from "@plane/utils";
import { RichTextEditor } from "@/components/editor/rich-text";
// helpers
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { AIResponseActions } from "./response-actions";

type Props = {
  handleInsertText: (insertOnNextLine: boolean) => void;
  handleRegenerate: () => Promise<void>;
  isRegenerating: boolean;
  response: string | undefined;
  workspaceSlug: string;
};

export function AskPiMenu(props: Props) {
  const { handleInsertText, handleRegenerate, isRegenerating, response, workspaceSlug } = props;
  // states
  const [query, setQuery] = useState("");
  // store hooks
  const { getWorkspaceBySlug } = useWorkspace();
  // derived values
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";

  return (
    <>
      <div
        className={cn("flex items-center gap-3 px-4 py-3.5", {
          "items-start": response,
        })}
      >
        <span className="grid size-7 flex-shrink-0 place-items-center rounded-full border border-subtle text-secondary">
          <AiStar1Outline className="size-3" />
        </span>
        {response ? (
          <div>
            <RichTextEditor
              editable={false}
              displayConfig={{
                fontSize: "small-font",
              }}
              id="editor-ai-response"
              initialValue={response}
              containerClassName="!p-0 border-none"
              editorClassName="!pl-0"
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
            />
            <AIResponseActions
              handleInsertText={handleInsertText}
              handleRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
            />
          </div>
        ) : (
          <p className="text-13 text-secondary">AI is answering...</p>
        )}
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-subtle p-2">
          <span className="grid size-3 flex-shrink-0 place-items-center">
            <AiStar1Outline className="size-3 text-secondary" />
          </span>
          <input
            type="text"
            className="w-full border-none bg-transparent text-13 outline-none placeholder:text-placeholder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tell AI what to do..."
          />
          <span className="grid size-4 flex-shrink-0 place-items-center">
            <CircleArrowUp className="size-4 text-secondary" />
          </span>
        </div>
      </div>
    </>
  );
}
