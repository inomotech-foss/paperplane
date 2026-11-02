/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane web imports
import { WORKSPACE_ESTIMATES, WORKSPACE_LABELS } from "@plane/constants";
import { useWorkspaceIssuePropertiesExtended } from "@/hooks/use-workspace-issue-properties-extended";
// plane imports
import { useWorkspaceCycles } from "./queries/use-cycle-queries";
import { useWorkspaceModules } from "./queries/use-module-queries";
import { useProjectEstimates } from "./store/estimates";
import { useLabel } from "./store/use-label";

export const useWorkspaceIssueProperties = (workspaceSlug: string | string[] | undefined) => {
  const { fetchWorkspaceLabels } = useLabel();

  const { getWorkspaceEstimates } = useProjectEstimates();

  useWorkspaceModules(workspaceSlug?.toString());
  useWorkspaceCycles(workspaceSlug?.toString());

  // fetch workspace labels
  useSWR(
    workspaceSlug ? WORKSPACE_LABELS(workspaceSlug.toString()) : null,
    workspaceSlug ? () => fetchWorkspaceLabels(workspaceSlug.toString()) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // fetch workspace estimates
  useSWR(
    workspaceSlug ? WORKSPACE_ESTIMATES(workspaceSlug.toString()) : null,
    workspaceSlug ? () => getWorkspaceEstimates(workspaceSlug.toString()) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // fetch extended issue properties
  useWorkspaceIssuePropertiesExtended(workspaceSlug);
};
