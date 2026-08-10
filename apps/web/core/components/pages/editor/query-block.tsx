/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { Avatar } from "@plane/ui";
import type { TQueryBlockHandlerProps } from "@plane/editor";
import { getFileURL, getPageName } from "@plane/utils";
// components
import { PageChildPagesTree } from "@/components/pages/editor/child-pages-block";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
import { useMember } from "@/hooks/store/use-member";
// services
import { PageQueryService } from "@/services/page";
import type { TPageQueryContributor, TPageQueryResult } from "@/services/page";
// store
import type { TPageInstance } from "@/store/pages/base-page";

const pageQueryService = new PageQueryService();

type Props = TQueryBlockHandlerProps & {
  page: TPageInstance;
  storeType: EPageStoreType;
};

function Shell(props: { children: React.ReactNode }) {
  return <div className="rounded-md border border-subtle px-2 py-1.5">{props.children}</div>;
}

function Empty(props: { message: string }) {
  return (
    <Shell>
      <p className="px-2 py-1.5 text-13 text-tertiary">{props.message}</p>
    </Shell>
  );
}

/**
 * A page row for results that come from the query endpoint rather than the
 * store, which only holds the pages of the project currently open.
 */
function QueryResultItem(props: { result: TPageQueryResult; workspaceSlug: string }) {
  const { result, workspaceSlug } = props;
  const projectId = result.project_ids?.[0];
  if (!projectId) return null;

  return (
    <Link
      href={`/${workspaceSlug}/projects/${projectId}/pages/${result.id}`}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors hover:bg-layer-1"
    >
      <span className="flex flex-shrink-0 items-center">
        {result.logo_props?.in_use ? (
          <Logo logo={result.logo_props} size={14} type="lucide" />
        ) : (
          <PageIcon className="size-3.5 text-tertiary" />
        )}
      </span>
      <span className="truncate text-13 font-medium">{getPageName(result.name)}</span>
    </Link>
  );
}

/**
 * A sub-page tree. Reads the page store rather than the endpoint so the list
 * updates as sub-pages are created, the way the child-pages block does. Falls
 * back to the page the block sits on, which is what every `pagetree` macro in
 * the Confluence backup means.
 */
const TreeQuery = observer(function TreeQuery(props: Props) {
  const { depth, page, rootPageId, storeType } = props;
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

  const rootId = rootPageId ?? page.id;
  if (!rootId || getChildPageIds(rootId).length === 0) {
    return <Empty message={t("page_query_block.empty_state.tree")} />;
  }

  return (
    <Shell>
      <PageChildPagesTree ancestorIds={new Set([rootId])} depth={depth ?? 1} pageId={rootId} storeType={storeType} />
    </Shell>
  );
});

/** Every kind that lists pages from the query endpoint. */
const EndpointQuery = observer(function EndpointQuery(props: Props) {
  const { kind, labels, limit, page, reverse, scope, sort } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();

  const projectId = page.project_ids?.[0];
  const slug = workspaceSlug?.toString();
  const params = {
    kind,
    scope,
    project_id: projectId,
    labels: labels.length > 0 ? labels.join(",") : undefined,
    limit,
    sort,
    reverse: reverse ? "true" : undefined,
  };

  const { data, isLoading, error } = useSWR(
    slug ? ["PAGE_QUERY", slug, JSON.stringify(params)] : null,
    slug ? () => pageQueryService.query(slug, params) : null
  );

  if (isLoading) return <Empty message={t("page_query_block.loading")} />;
  if (error) return <Empty message={t("page_query_block.error")} />;
  if (!data || data.length === 0) return <Empty message={t("page_query_block.empty_state.pages")} />;

  return (
    <Shell>
      <div className="space-y-0.5">
        {data.map((result) => (
          <QueryResultItem key={result.id} result={result} workspaceSlug={slug ?? ""} />
        ))}
      </div>
    </Shell>
  );
});

function ContributorItem(props: { contributor: TPageQueryContributor }) {
  const { contributor } = props;
  const { getUserDetails } = useMember();
  const { t } = useTranslation();

  const user = getUserDetails(contributor.user_id);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Avatar src={getFileURL(user?.avatar_url ?? "")} name={user?.display_name} />
      <span className="truncate text-13 font-medium">{user?.display_name ?? t("page_query_block.unknown_user")}</span>
      <span className="ml-auto flex-shrink-0 text-13 text-tertiary">
        {t("page_query_block.page_count", { count: contributor.page_count })}
      </span>
    </div>
  );
}

/** Who authored the pages in scope, and how many each. */
const ContributorsQuery = observer(function ContributorsQuery(props: Props) {
  const { limit, page, scope } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();

  const slug = workspaceSlug?.toString();
  const params = { kind: "contributors", scope, project_id: page.project_ids?.[0], limit };

  const { data, isLoading, error } = useSWR(
    slug ? ["PAGE_QUERY", slug, JSON.stringify(params)] : null,
    slug ? () => pageQueryService.query<TPageQueryContributor>(slug, params) : null
  );

  if (isLoading) return <Empty message={t("page_query_block.loading")} />;
  if (error) return <Empty message={t("page_query_block.error")} />;
  if (!data || data.length === 0) return <Empty message={t("page_query_block.empty_state.contributors")} />;

  return (
    <Shell>
      <div className="space-y-0.5">
        {data.map((contributor) => (
          <ContributorItem key={contributor.user_id} contributor={contributor} />
        ))}
      </div>
    </Shell>
  );
});

export const PageQueryBlock = observer(function PageQueryBlock(props: Props) {
  const { t } = useTranslation();

  switch (props.kind) {
    case "tree":
      return <TreeQuery {...props} />;
    case "index":
    case "recent":
      return <EndpointQuery {...props} />;
    case "contributors":
      return <ContributorsQuery {...props} />;
    default:
      // Kinds land one PR at a time, and an unrecognised one must still say
      // that something was here rather than render an empty box.
      return <Empty message={t("page_query_block.unsupported")} />;
  }
});
