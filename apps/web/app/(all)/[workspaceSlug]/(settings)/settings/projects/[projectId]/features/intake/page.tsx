/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { IntakeEnableControl } from "@/components/settings/project/content/intake-enable-control";
import { IntakeTypeControlItem } from "@/components/settings/project/content/intake-type-control-item";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { FeaturesIntakeProjectSettingsHeader } from "./header";

function FeaturesIntakeSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails } = useProject();
  // translation
  const { t } = useTranslation();
  // derived values
  const pageTitle = currentProjectDetails?.name
    ? `${currentProjectDetails?.name} settings - ${t("project_settings.features.intake.short_title")}`
    : undefined;
  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<FeaturesIntakeProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <section className="w-full">
        <SettingsHeading
          title={t("project_settings.features.intake.title")}
          description={t("project_settings.features.intake.description")}
        />
        <div className="mt-7 flex flex-col gap-3">
          <SettingsBoxedControlItem
            title={t("project_settings.features.intake.toggle_title")}
            description={
              currentProjectDetails?.inbox_view
                ? t("project_settings.features.intake.toggle_description")
                : t("project_settings.features.intake.enable_description")
            }
            control={<IntakeEnableControl workspaceSlug={workspaceSlug} projectId={projectId} />}
          />
          {currentProjectDetails?.inbox_view && (
            <IntakeTypeControlItem workspaceSlug={workspaceSlug} projectId={projectId} />
          )}
        </div>
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(FeaturesIntakeSettingsPage);
