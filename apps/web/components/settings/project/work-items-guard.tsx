/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, PROJECT_SETTINGS, PROJECT_SETTINGS_FLAT_MAP } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// assets
import darkWorkItemsAsset from "@/app/assets/empty-state/all-issues/all-issues-dark.webp?url";
import lightWorkItemsAsset from "@/app/assets/empty-state/all-issues/all-issues-light.webp?url";
// components
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { findProjectSetting, isProjectSettingVisible } from "./work-items-dependency";

type Props = {
  workspaceSlug: string;
  projectId: string;
  children: React.ReactNode;
};

export const ProjectSettingsWorkItemsGuard = observer(function ProjectSettingsWorkItemsGuard(props: Props) {
  const { workspaceSlug, projectId, children } = props;
  // router
  const router = useAppRouter();
  const pathname = usePathname();
  // theme
  const { resolvedTheme } = useTheme();
  // store hooks
  const { getPartialProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  // translation
  const { t } = useTranslation();
  // derived values
  const baseUrl = `/${workspaceSlug}/settings/projects/${projectId}`;
  const activeSetting = findProjectSetting(PROJECT_SETTINGS_FLAT_MAP, pathname, baseUrl);
  const project = getPartialProjectById(projectId);

  if (!activeSetting || isProjectSettingVisible(activeSetting.key, project)) return <>{children}</>;

  const canManageFeatures = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  return (
    <div className="flex size-full items-center justify-center">
      <DetailedEmptyState
        title={t("disabled_project.empty_state.work_item.title")}
        description={t("disabled_project.empty_state.work_item.description")}
        assetPath={resolvedTheme === "light" ? lightWorkItemsAsset : darkWorkItemsAsset}
        primaryButton={{
          text: t("disabled_project.empty_state.work_item.primary_button.text"),
          onClick: () => router.push(`${baseUrl}${PROJECT_SETTINGS.features_work_items.href}/`),
          disabled: !canManageFeatures,
        }}
      />
    </div>
  );
});
