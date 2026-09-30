/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { PageAttachmentListItem } from "@/components/pages/navigation-pane/tab-panels/attachments/list-item";
import { usePageAttachments } from "@/components/pages/navigation-pane/tab-panels/attachments/use-page-attachments";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  page: TPageInstance;
};

export const PageAttachmentsBlock = observer(function PageAttachmentsBlock(props: Props) {
  const { page } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();

  // Uploading and removing stay in the navigation pane, which is where the page
  // owns its files; the block is a view of them.
  const { attachments } = usePageAttachments({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: page.project_ids?.[0],
    pageId: page.id,
  });

  return (
    <div className="rounded-md border border-subtle px-2 py-1.5">
      {attachments.length > 0 ? (
        attachments.map((attachment) => <PageAttachmentListItem key={attachment.id} attachment={attachment} />)
      ) : (
        <p className="px-2 py-1.5 text-13 text-tertiary">
          {t("page_navigation_pane.tabs.assets.attachments.empty_state.title")}
        </p>
      )}
    </div>
  );
});
