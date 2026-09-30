/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { SubPageItem } from "@/components/pages/sub-page-item";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  depth: number;
  page: TPageInstance;
  storeType: EPageStoreType;
};

type TreeProps = {
  ancestorIds: Set<string>;
  depth: number;
  pageId: string;
  storeType: EPageStoreType;
};

/** Shared with the query block's `tree` kind, which lists the same thing. */
export const PageChildPagesTree = observer(function PageChildPagesTree(props: TreeProps) {
  const { ancestorIds, depth, pageId, storeType } = props;
  const { getChildPageIds } = usePageStore(storeType);

  if (depth <= 0) return null;

  // pageChildrenMap is server-derived and a cycle in it would recurse forever
  const childPageIds = getChildPageIds(pageId).filter((id) => !ancestorIds.has(id));
  if (childPageIds.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {childPageIds.map((childPageId) => (
        <div key={childPageId}>
          <SubPageItem pageId={childPageId} storeType={storeType} />
          <div className="pl-4">
            <PageChildPagesTree
              ancestorIds={new Set(ancestorIds).add(childPageId)}
              depth={depth - 1}
              pageId={childPageId}
              storeType={storeType}
            />
          </div>
        </div>
      ))}
    </div>
  );
});

export const PageChildPagesBlock = observer(function PageChildPagesBlock(props: Props) {
  const { depth, page, storeType } = props;
  const { workspaceSlug } = useParams();
  const { getChildPageIds, fetchPagesList } = usePageStore(storeType);
  const { t } = useTranslation();

  const projectId = page.project_ids?.[0];
  // the block can be the first thing a reader sees, so make sure the list is
  // loaded even when the page is opened directly
  useSWR(
    workspaceSlug && projectId ? `PROJECT_PAGES_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchPagesList(workspaceSlug.toString(), projectId) : null
  );

  const hasChildren = !!page.id && getChildPageIds(page.id).length > 0;

  return (
    <div className="rounded-md border border-subtle px-2 py-1.5">
      {page.id && hasChildren ? (
        <PageChildPagesTree ancestorIds={new Set([page.id])} depth={depth} pageId={page.id} storeType={storeType} />
      ) : (
        <p className="px-2 py-1.5 text-13 text-tertiary">
          {t("page_navigation_pane.tabs.sub_pages.empty_state.title")}
        </p>
      )}
    </div>
  );
});
