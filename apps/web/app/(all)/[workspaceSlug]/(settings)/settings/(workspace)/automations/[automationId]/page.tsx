/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
// plane web imports
import { AutomationDesignerRoot } from "@/components/automations/designer/root";
// local imports
import type { Route } from "./+types/page";
import { AutomationsWorkspaceSettingsHeader } from "../header";

function WorkspaceAutomationDesignerPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, automationId } = params;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();

  const canPerformWorkspaceAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  if (workspaceUserInfo && !canPerformWorkspaceAdminActions) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  const pageTitle = currentWorkspace?.name
    ? `${currentWorkspace.name} - ${t("automations.global_automations.settings.title")}`
    : undefined;

  return (
    <SettingsContentWrapper header={<AutomationsWorkspaceSettingsHeader />}>
      <PageHead title={pageTitle} />
      {/* No projectId: workspace rules aren't pinned to one project. */}
      <AutomationDesignerRoot
        workspaceSlug={workspaceSlug}
        automationId={automationId}
        disabled={!canPerformWorkspaceAdminActions}
      />
    </SettingsContentWrapper>
  );
}

export default observer(WorkspaceAutomationDesignerPage);
