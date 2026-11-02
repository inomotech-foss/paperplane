// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import { InboxIssueCreateModalRoot } from "../modals/create-modal";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export function InboxSidebarOpenEmptyState({ workspaceSlug, projectId }: Props) {
  const { t } = useTranslation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <>
      <InboxIssueCreateModalRoot
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        modalState={isCreateModalOpen}
        handleModalClose={() => setIsCreateModalOpen(false)}
      />
      <EmptyStateDetailed
        assetKey="inbox"
        title={t("project_empty_state.intake_sidebar.title")}
        description={t("project_empty_state.intake_sidebar.description")}
        assetClassName="size-20"
        actions={[
          {
            label: t("project_empty_state.intake_sidebar.cta_primary"),
            onClick: () => setIsCreateModalOpen(true),
            variant: "primary",
          },
        ]}
        rootClassName="px-page-x"
      />
    </>
  );
}
