/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { TAIHandler } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { useInstance } from "@/hooks/store/use-instance";
import { useUserPermissions } from "@/hooks/store/user";
import { WritingAssistantMenu } from "./writing-menu";

type TArgs = {
  workspaceId: string;
  workspaceSlug: string;
  projectId?: string;
};

/**
 * The editor AI handler. Undefined, which hides the AI entry, when the instance has no LLM
 * or the user's workspace role cannot use the writing assistant.
 */
export function useWritingAssistant(args: TArgs): TAIHandler | undefined {
  const { workspaceId, workspaceSlug, projectId } = args;
  const { t } = useTranslation();
  const { config } = useInstance();
  const { allowPermissions } = useUserPermissions();
  const isEnabled =
    !!config?.has_llm_configured &&
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const label = t("ai_writing.label");

  return useMemo(
    () =>
      isEnabled
        ? {
            label,
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
    [isEnabled, label, workspaceId, workspaceSlug, projectId]
  );
}
