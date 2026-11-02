/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { EUserProjectRoles } from "@plane/types";
// components
import { LoadErrorState } from "@/components/common/load-error-state";
import { ListLayout } from "@/components/core/list";
import { ViewListLoader } from "@/components/ui/loader/view-list-loader";
// hooks
import { useProjectViews } from "@/hooks/queries/use-project-view-queries";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProjectView } from "@/hooks/store/use-project-view";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { ProjectViewListItem } from "./view-list-item";

export const ProjectViewsList = observer(function ProjectViewsList() {
  const { workspaceSlug, projectId } = useParams();
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { toggleCreateViewModal } = useCommandPalette();
  const { getProjectViews, getFilteredProjectViews } = useProjectView();
  const { isLoading, error, retry } = useProjectViews(workspaceSlug?.toString(), projectId?.toString());
  const { allowPermissions } = useUserPermissions();
  // derived values
  const projectViews = projectId ? getProjectViews(projectId.toString()) : [];
  const filteredProjectViews = projectId ? getFilteredProjectViews(projectId.toString()) : [];
  const canPerformEmptyStateActions = allowPermissions(
    [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER, EUserProjectRoles.GUEST],
    EUserPermissionsLevel.PROJECT
  );

  if (isLoading) return <ViewListLoader />;
  if (error) return <LoadErrorState onRetry={retry} />;

  if (filteredProjectViews.length === 0 && projectViews.length > 0) {
    return (
      <EmptyStateDetailed
        assetKey="search"
        title={t("common_empty_state.search.title")}
        description={t("common_empty_state.search.description")}
      />
    );
  }

  return (
    <>
      {filteredProjectViews.length > 0 ? (
        <div className="flex h-full w-full flex-col">
          <ListLayout>
            {filteredProjectViews.length > 0 ? (
              filteredProjectViews.map((view) => <ProjectViewListItem key={view.id} view={view} />)
            ) : (
              <p className="mt-10 text-center text-13 text-tertiary">No results found</p>
            )}
          </ListLayout>
        </div>
      ) : (
        <EmptyStateDetailed
          assetKey="view"
          title={t("project_empty_state.views.title")}
          description={t("project_empty_state.views.description")}
          actions={[
            {
              label: t("project_empty_state.views.cta_primary"),
              onClick: () => toggleCreateViewModal(true),
              disabled: !canPerformEmptyStateActions,
              variant: "primary",
            },
          ]}
        />
      )}
    </>
  );
});
