/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { EInboxIssueCurrentTab } from "@plane/types";
// components
import { PageHead } from "@/components/core/page-title";
import { InboxIssueRoot } from "@/components/inbox";
// hooks
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

function ProjectInboxPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const searchParams = useSearchParams();
  const navigationTab = searchParams.get("currentTab");
  const inboxIssueId = searchParams.get("inboxIssueId");
  // plane hooks
  const { t } = useTranslation();
  // hooks
  const { currentProjectDetails } = useProject();
  // derived values
  const pageTitle = currentProjectDetails?.name
    ? t("inbox_issue.page_label", {
        workspace: currentProjectDetails?.name,
      })
    : t("inbox_issue.page_label", {
        workspace: "Plane",
      });

  const currentNavigationTab = navigationTab
    ? navigationTab === "open"
      ? EInboxIssueCurrentTab.OPEN
      : EInboxIssueCurrentTab.CLOSED
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHead title={pageTitle} />
      <div className="h-full w-full overflow-hidden">
        <InboxIssueRoot
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          inboxIssueId={inboxIssueId || undefined}
          inboxAccessible={currentProjectDetails?.inbox_view || false}
          navigationTab={currentNavigationTab}
        />
      </div>
    </div>
  );
}

export default observer(ProjectInboxPage);
