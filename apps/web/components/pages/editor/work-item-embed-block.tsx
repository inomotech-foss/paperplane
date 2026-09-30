/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import type { TWorkItemEmbedHandlerProps } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
// components
import { WorkItemPreviewCard } from "@/components/issues/preview-card";
// services
import { IssueService } from "@/services/issue";

const issueService = new IssueService();

/**
 * The embed names a work item by id and can point at another project, so the
 * card loads on its own rather than reading the page's own issue stores.
 */
export const PageWorkItemEmbedBlock = observer(function PageWorkItemEmbedBlock(props: TWorkItemEmbedHandlerProps) {
  const { projectId, workItemId, workspaceSlug } = props;
  const { t } = useTranslation();

  const canFetch = !!workspaceSlug && !!projectId;
  const { data: workItem, error } = useSWR(
    canFetch ? `WORK_ITEM_EMBED_${workspaceSlug}_${projectId}_${workItemId}` : null,
    canFetch ? () => issueService.retrieve(workspaceSlug, projectId, workItemId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  if (!canFetch || error) {
    return (
      <div className="rounded-md border border-subtle px-2 py-1.5">
        <p className="px-2 py-1.5 text-13 text-tertiary">{t("page_work_item_embed.error")}</p>
      </div>
    );
  }

  if (!workItem) {
    return (
      <div className="rounded-md border border-subtle px-2 py-1.5">
        <p className="px-2 py-1.5 text-13 text-tertiary">{t("page_work_item_embed.loading")}</p>
      </div>
    );
  }

  return (
    <WorkItemPreviewCard
      projectId={projectId}
      stateDetails={{ id: workItem.state_id ?? undefined }}
      workItem={workItem}
    />
  );
});
