// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TPqlDialect } from "@plane/types";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";

/** The member's own dialect wins; null follows the workspace, and nothing loaded yet means jql. */
export const effectiveDialect = (
  member: TPqlDialect | null | undefined,
  workspace: TPqlDialect | undefined
): TPqlDialect => member ?? workspace ?? "jql";

/** The PQL dialect the query bar completes and explains in, for the current user in a workspace. */
export const usePqlDialect = (workspaceSlug: string) => {
  const { getWorkspaceBySlug } = useWorkspace();
  const { workspaceInfoBySlug, updateWorkspaceMemberDialect } = useUserPermissions();
  const workspaceDialect = getWorkspaceBySlug(workspaceSlug)?.pql_dialect ?? "jql";
  const memberDialect = workspaceInfoBySlug(workspaceSlug)?.pql_dialect ?? null;
  return {
    dialect: effectiveDialect(memberDialect, workspaceDialect),
    workspaceDialect,
    memberDialect,
    setMemberDialect: (dialect: TPqlDialect | null) => updateWorkspaceMemberDialect(workspaceSlug, dialect),
  };
};
