/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// plane web imports
import { AutomationDesignerRoot } from "@/plane-web/components/automations/designer/root";
// local imports
import type { Route } from "./+types/page";
import { AutomationsProjectSettingsHeader } from "../header";

function AutomationDesignerPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId, automationId } = params;
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails } = useProject();

  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  const pageTitle = currentProjectDetails?.name ? `${currentProjectDetails.name} - Automations` : undefined;

  return (
    <SettingsContentWrapper header={<AutomationsProjectSettingsHeader />} hugging>
      <PageHead title={pageTitle} />
      <AutomationDesignerRoot
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        automationId={automationId}
        disabled={!canPerformProjectAdminActions}
      />
    </SettingsContentWrapper>
  );
}

export default observer(AutomationDesignerPage);
