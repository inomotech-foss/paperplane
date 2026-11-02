/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane types
import type { IModule, TIssue } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
// components
import { LoadErrorState } from "@/components/common/load-error-state";
import { PowerKModulesMenu } from "@/components/power-k/menus/modules";
// hooks
import { useProjectModules } from "@/hooks/queries/use-module-queries";
import { useModule } from "@/hooks/store/use-module";

type Props = {
  handleSelect: (module: IModule) => void;
  workItemDetails: TIssue;
};

export const PowerKWorkItemModulesMenu = observer(function PowerKWorkItemModulesMenu(props: Props) {
  const { handleSelect, workItemDetails } = props;
  // store hooks
  const { workspaceSlug } = useParams();
  const { getProjectModuleIds, getModuleById } = useModule();
  const { isLoading, error, retry } = useProjectModules(workspaceSlug?.toString(), workItemDetails.project_id);
  // derived values
  const filteredModulesList = workItemDetails.project_id
    ? getProjectModuleIds(workItemDetails.project_id)
        .map((moduleId) => getModuleById(moduleId))
        .filter((module) => !!module)
    : [];

  if (isLoading) return <Spinner />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return (
    <PowerKModulesMenu modules={filteredModulesList} onSelect={handleSelect} value={workItemDetails.module_ids ?? []} />
  );
});
