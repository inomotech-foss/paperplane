/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useWorkspaceIssuePropertiesExtended } from "@/hooks/use-workspace-issue-properties-extended";
import { useWorkspaceCycles } from "./queries/use-cycle-queries";
import { useWorkspaceEstimatesQuery } from "./queries/use-estimate-queries";
import { useWorkspaceLabels } from "./queries/use-label-queries";
import { useWorkspaceModules } from "./queries/use-module-queries";

export const useWorkspaceIssueProperties = (workspaceSlug: string | string[] | undefined) => {
  useWorkspaceModules(workspaceSlug?.toString());
  useWorkspaceCycles(workspaceSlug?.toString());
  useWorkspaceLabels(workspaceSlug?.toString());
  useWorkspaceEstimatesQuery(workspaceSlug?.toString());
  useWorkspaceIssuePropertiesExtended(workspaceSlug);
};
