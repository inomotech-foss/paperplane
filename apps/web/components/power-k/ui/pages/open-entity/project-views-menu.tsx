/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane types
import type { IProjectView } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
// components
import { LoadErrorState } from "@/components/common/load-error-state";
import type { TPowerKContext } from "@/components/power-k/core/types";
// hooks
import { PowerKViewsMenu } from "@/components/power-k/menus/views";
import { useProjectViews } from "@/hooks/queries/use-project-view-queries";
import { useProjectView } from "@/hooks/store/use-project-view";

type Props = {
  context: TPowerKContext;
  handleSelect: (view: IProjectView) => void;
};

export const PowerKOpenProjectViewsMenu = observer(function PowerKOpenProjectViewsMenu(props: Props) {
  const { context, handleSelect } = props;
  // store hooks
  const { getProjectViews } = useProjectView();
  // derived values
  const projectId = context.params.projectId?.toString();
  const { isLoading, error, retry } = useProjectViews(context.params.workspaceSlug?.toString(), projectId);
  const viewsList = projectId ? getProjectViews(projectId) : [];

  if (isLoading) return <Spinner />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return <PowerKViewsMenu views={viewsList} onSelect={handleSelect} />;
});
