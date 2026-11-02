/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane types
import type { IModule } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
// components
import { LoadErrorState } from "@/components/common/load-error-state";
import type { TPowerKContext } from "@/components/power-k/core/types";
import { PowerKModulesMenu } from "@/components/power-k/menus/modules";
// hooks
import { useProjectModules } from "@/hooks/queries/use-module-queries";
import { useModule } from "@/hooks/store/use-module";

type Props = {
  context: TPowerKContext;
  handleSelect: (module: IModule) => void;
};

export const PowerKOpenProjectModulesMenu = observer(function PowerKOpenProjectModulesMenu(props: Props) {
  const { context, handleSelect } = props;
  // store hooks
  const { getProjectModuleIds, getModuleById } = useModule();
  // derived values
  const projectId = context.params.projectId?.toString();
  const { isLoading, error, retry } = useProjectModules(context.params.workspaceSlug?.toString(), projectId);
  const modulesList = projectId
    ? getProjectModuleIds(projectId)
        .map((moduleId) => getModuleById(moduleId))
        .filter((module) => !!module)
    : [];

  if (isLoading) return <Spinner />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return <PowerKModulesMenu modules={modulesList} onSelect={handleSelect} />;
});
