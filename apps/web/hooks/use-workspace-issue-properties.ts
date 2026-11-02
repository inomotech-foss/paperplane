/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane web imports
import { WORKSPACE_ESTIMATES } from "@plane/constants";
import { useWorkspaceIssuePropertiesExtended } from "@/hooks/use-workspace-issue-properties-extended";
// plane imports
import { useWorkspaceCycles } from "./queries/use-cycle-queries";
import { useWorkspaceLabels } from "./queries/use-label-queries";
import { useWorkspaceModules } from "./queries/use-module-queries";
import { useProjectEstimates } from "./store/estimates";

export const useWorkspaceIssueProperties = (workspaceSlug: string | string[] | undefined) => {
  const { getWorkspaceEstimates } = useProjectEstimates();

  useWorkspaceModules(workspaceSlug?.toString());
  useWorkspaceCycles(workspaceSlug?.toString());
  useWorkspaceLabels(workspaceSlug?.toString());

  // fetch workspace estimates
  useSWR(
    workspaceSlug ? WORKSPACE_ESTIMATES(workspaceSlug.toString()) : null,
    workspaceSlug ? () => getWorkspaceEstimates(workspaceSlug.toString()) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // fetch extended issue properties
  useWorkspaceIssuePropertiesExtended(workspaceSlug);
};
