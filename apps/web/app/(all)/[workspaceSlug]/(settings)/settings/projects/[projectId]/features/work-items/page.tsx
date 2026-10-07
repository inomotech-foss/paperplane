/**
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
import { ProjectIssueSequenceSection } from "@/components/project/settings/issue-sequence-section";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { ProjectSettingsFeatureControlItem } from "@/components/settings/project/content/feature-control-item";
import { isWorkItemsEnabled } from "@/components/settings/project/work-items-dependency";
import { ProjectSettingsTabHeader } from "@/components/settings/project/tab-header";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";

function FeaturesWorkItemsSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails } = useProject();
  // translation
  const { t } = useTranslation();
  // derived values
  const pageTitle = currentProjectDetails?.name
    ? `${currentProjectDetails?.name} settings - ${t("project_settings.features.work_items.short_title")}`
    : undefined;
  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<ProjectSettingsTabHeader tab="features_work_items" />}>
      <PageHead title={pageTitle} />
      <section className="w-full">
        <SettingsHeading
          title={t("project_settings.features.work_items.title")}
          description={t("project_settings.features.work_items.description")}
        />
        <div className="mt-7 flex flex-col gap-3">
          <ProjectSettingsFeatureControlItem
            title={t("project_settings.features.work_items.toggle_title")}
            description={t("project_settings.features.work_items.toggle_description")}
            featureProperty="issue_view"
            projectId={projectId}
            value={!!currentProjectDetails?.issue_view}
            workspaceSlug={workspaceSlug}
          />
          {isWorkItemsEnabled(currentProjectDetails) && (
            <ProjectIssueSequenceSection workspaceSlug={workspaceSlug} projectId={projectId} />
          )}
        </div>
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(FeaturesWorkItemsSettingsPage);
