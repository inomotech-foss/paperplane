/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import type { TAIHandler } from "@plane/editor";
import { useInstance } from "@/hooks/store/use-instance";
import { WritingAssistantMenu } from "./writing-menu";

type TArgs = {
  workspaceId: string;
  workspaceSlug: string;
  projectId?: string;
};

/** The editor AI handler, or undefined when the instance has no LLM, which hides the AI entry. */
export function useWritingAssistant(args: TArgs): TAIHandler | undefined {
  const { workspaceId, workspaceSlug, projectId } = args;
  const { config } = useInstance();
  const isEnabled = !!config?.has_llm_configured;

  return useMemo(
    () =>
      isEnabled
        ? {
            menu: (menuProps) => (
              <WritingAssistantMenu
                {...menuProps}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
              />
            ),
          }
        : undefined,
    [isEnabled, workspaceId, workspaceSlug, projectId]
  );
}
