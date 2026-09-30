/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Tooltip } from "@makeplane/propel/components/tooltip";
import { CornerRightDownOutline, RefreshOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";

type Props = {
  handleInsertText: (insertOnNextLine: boolean) => void;
  handleRegenerate: () => void;
  isRegenerating: boolean;
};

/** Replace / insert / regenerate row below an AI response, shared by the editor AI menus. */
export function AIResponseActions(props: Props) {
  const { handleInsertText, handleRegenerate, isRegenerating } = props;

  return (
    <div className="mt-3 flex items-center gap-4">
      <button
        type="button"
        className="rounded-sm p-1 text-13 font-medium text-tertiary outline-none hover:bg-layer-1"
        onClick={() => handleInsertText(false)}
      >
        Replace selection
      </button>
      <Tooltip label="Add to next line">
        <button
          type="button"
          className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1"
          onClick={() => handleInsertText(true)}
        >
          <CornerRightDownOutline className="size-4 text-tertiary" />
        </button>
      </Tooltip>
      <Tooltip label="Re-generate response">
        <button
          type="button"
          className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRegenerate();
          }}
          disabled={isRegenerating}
        >
          <RefreshOutline
            className={cn("size-4 text-tertiary", {
              "animate-spin": isRegenerating,
            })}
          />
        </button>
      </Tooltip>
    </div>
  );
}
