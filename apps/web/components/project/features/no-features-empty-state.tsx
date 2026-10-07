// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { observer } from "mobx-react";
import { useTheme } from "next-themes";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, PROJECT_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// assets
import darkAsset from "@/app/assets/empty-state/all-issues/all-issues-dark.webp?url";
import lightAsset from "@/app/assets/empty-state/all-issues/all-issues-light.webp?url";
// components
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { PROJECT_FEATURES } from "./features";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectNoFeaturesEmptyState = observer(function ProjectNoFeaturesEmptyState(props: Props) {
  const { workspaceSlug, projectId } = props;
  const router = useAppRouter();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const canManageFeatures = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const settingsUrl = `/${workspaceSlug}/settings/projects/${projectId}${PROJECT_SETTINGS[PROJECT_FEATURES[0].settingsKey].href}/`;

  return (
    <div className="flex size-full items-center justify-center">
      <DetailedEmptyState
        title={t("disabled_project.empty_state.no_features.title")}
        description={t("disabled_project.empty_state.no_features.description")}
        assetPath={resolvedTheme === "light" ? lightAsset : darkAsset}
        primaryButton={{
          text: t("disabled_project.empty_state.no_features.primary_button.text"),
          onClick: () => router.push(settingsUrl),
          disabled: !canManageFeatures,
        }}
      />
    </div>
  );
});
