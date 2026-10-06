/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, PROJECT_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// assets
import darkWorkItemsAsset from "@/app/assets/empty-state/all-issues/all-issues-dark.webp?url";
import lightWorkItemsAsset from "@/app/assets/empty-state/all-issues/all-issues-light.webp?url";
// components
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { isWorkItemsEnabled } from "@/components/settings/project/work-items-dependency";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

type Props = {
  children: React.ReactNode;
};

// Blocks pages that need work items while the project has them off.
export const ProjectWorkItemsGuard = observer(function ProjectWorkItemsGuard({ children }: Props) {
  const { workspaceSlug, projectId } = useParams();
  // router
  const router = useAppRouter();
  // theme
  const { resolvedTheme } = useTheme();
  // store hooks
  const { getPartialProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  // translation
  const { t } = useTranslation();
  // derived values
  const project = getPartialProjectById(projectId?.toString());

  // Render nothing until loaded so the page does not flash or fetch.
  if (!project) return null;
  if (isWorkItemsEnabled(project)) return <>{children}</>;

  const canManageFeatures = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug?.toString(),
    project.id
  );
  const settingsUrl = `/${workspaceSlug?.toString()}/settings/projects/${project.id}${PROJECT_SETTINGS.features_work_items.href}/`;

  return (
    <div className="flex size-full items-center justify-center">
      <DetailedEmptyState
        title={t("disabled_project.empty_state.work_item.title")}
        description={t("disabled_project.empty_state.work_item.description")}
        assetPath={resolvedTheme === "light" ? lightWorkItemsAsset : darkWorkItemsAsset}
        primaryButton={{
          text: t("disabled_project.empty_state.work_item.primary_button.text"),
          onClick: () => router.push(settingsUrl),
          disabled: !canManageFeatures,
        }}
      />
    </div>
  );
});
