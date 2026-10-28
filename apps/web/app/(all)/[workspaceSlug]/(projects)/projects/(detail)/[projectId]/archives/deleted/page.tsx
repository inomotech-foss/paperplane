/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
// components
import { DeletedWorkItemsHeader, DeletedWorkItemsRoot } from "@/components/archives";
import { PageHead } from "@/components/core/page-title";
// hooks
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

function ProjectDeletedWorkItemsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { getProjectById } = useProject();
  const { t } = useTranslation();
  const project = getProjectById(projectId);

  return (
    <>
      <PageHead title={project?.name && `${project.name} - ${t("issue.trash.page_title")}`} />
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <DeletedWorkItemsHeader />
        <DeletedWorkItemsRoot workspaceSlug={workspaceSlug} projectId={projectId} />
      </div>
    </>
  );
}

export default observer(ProjectDeletedWorkItemsPage);
