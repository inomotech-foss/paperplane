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
import { ProjectSettingsFeatureControlItem } from "@/components/settings/project/content/feature-control-item";
import { PageApproversSettings } from "@/components/pages/approval/approvers-settings";
import { PageBaselineSettings } from "@/components/pages/approval/baseline-settings";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { FeaturesPagesProjectSettingsHeader } from "./header";

function FeaturesPagesSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails } = useProject();
  // translation
  const { t } = useTranslation();
  // derived values
  const pageTitle = currentProjectDetails?.name
    ? `${currentProjectDetails?.name} settings - ${t("project_settings.features.pages.short_title")}`
    : undefined;
  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<FeaturesPagesProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <section className="w-full">
        <SettingsHeading
          title={t("project_settings.features.pages.title")}
          description={t("project_settings.features.pages.description")}
        />
        <div className="mt-7">
          <ProjectSettingsFeatureControlItem
            title={t("project_settings.features.pages.toggle_title")}
            description={t("project_settings.features.pages.toggle_description")}
            featureProperty="page_view"
            projectId={projectId}
            value={!!currentProjectDetails?.page_view}
            workspaceSlug={workspaceSlug}
          />
        </div>
        <div className="mt-4 flex flex-col gap-y-4">
          <ProjectSettingsFeatureControlItem
            title="Page approvals"
            description="Pages need review and approval before they take effect. Readers see the approved version, and every submission and decision is logged."
            featureProperty="is_page_approval_enabled"
            projectId={projectId}
            value={!!currentProjectDetails?.is_page_approval_enabled}
            workspaceSlug={workspaceSlug}
          />
          {currentProjectDetails?.is_page_approval_enabled && (
            <>
              <PageApproversSettings workspaceSlug={workspaceSlug} projectId={projectId} />
              <PageBaselineSettings workspaceSlug={workspaceSlug} projectId={projectId} />
            </>
          )}
        </div>
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(FeaturesPagesSettingsPage);
