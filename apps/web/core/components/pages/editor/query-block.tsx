/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { Avatar } from "@plane/ui";
import type { TQueryBlockHandlerProps } from "@plane/editor";
import { calculateTimeAgo, getFileURL, getPageName } from "@plane/utils";
// components
import { PageChildPagesTree } from "@/components/pages/editor/child-pages-block";
import { SubPageItem } from "@/components/pages/sub-page-item";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
import { useMember } from "@/hooks/store/use-member";
// services
import { PageQueryService } from "@/services/page";
import type { TPageQueryContributor, TPageQueryLabel, TPageQueryResult } from "@/services/page";
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

/** The labels in use, rather than the pages carrying them. */
const LabelListQuery = observer(function LabelListQuery(props: Props) {
  const { limit, page, scope } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();

  const slug = workspaceSlug?.toString();
  const params = { kind: "label-list", scope, project_id: page.project_ids?.[0], limit };

  const { data, isLoading, error } = useSWR(
    slug ? ["PAGE_QUERY", slug, JSON.stringify(params)] : null,
    slug ? () => pageQueryService.query<TPageQueryLabel>(slug, params) : null
  );

  if (isLoading) return <Empty message={t("page_query_block.loading")} />;
  if (error) return <Empty message={t("page_query_block.error")} />;
  if (!data || data.length === 0) return <Empty message={t("page_query_block.empty_state.labels")} />;

  return (
    <Shell>
      <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
        {data.map((label) => (
          <span key={label.id} className="rounded-full bg-layer-1 px-2 py-0.5 text-13 text-secondary">
            {label.name}
          </span>
        ))}
      </div>
    </Shell>
  );
});

/**
 * Pages as rows, with their page properties as columns. Falls back to when the
 * page last changed when the macro named no columns, which is what the
 * content-report variant of this table shows.
 */
const PagePropertiesQuery = observer(function PagePropertiesQuery(props: Props) {
  const { columns, labels, limit, page, reverse, scope, sort } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();

  const slug = workspaceSlug?.toString();
  const params = {
    kind: "page-properties",
    scope,
    project_id: page.project_ids?.[0],
    labels: labels.length > 0 ? labels.join(",") : undefined,
    columns: columns.length > 0 ? columns.join(",") : undefined,
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
      <div className="overflow-x-auto">
        <table className="w-full text-13">
          <thead>
            <tr className="border-b border-subtle text-left text-tertiary">
              <th className="px-2 py-1.5 font-medium">{t("page_query_block.columns.title")}</th>
              {columns.map((column) => (
                <th key={column} className="px-2 py-1.5 font-medium">
                  {column}
                </th>
              ))}
              {columns.length === 0 && (
                <th className="px-2 py-1.5 font-medium">{t("page_query_block.columns.updated")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((result) => (
              <tr key={result.id} className="border-b border-subtle last:border-none">
                <td className="px-2 py-1.5">
                  <QueryResultItem result={result} workspaceSlug={slug ?? ""} />
                </td>
                {columns.map((column) => (
                  <td key={column} className="px-2 py-1.5 text-secondary">
                    {result.properties?.[column] ?? ""}
                  </td>
                ))}
                {columns.length === 0 && (
                  <td className="px-2 py-1.5 text-tertiary">{calculateTimeAgo(result.updated_at)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
});

/**
 * A search box over pages. `page` scope searches the current page's subtree,
 * which the store can answer without a round trip because the project's pages
 * are already loaded; anything wider goes to the endpoint.
 */
const SearchQuery = observer(function SearchQuery(props: Props) {
  const { page, placeholder, rootPageId, scope, storeType } = props;
  const { workspaceSlug } = useParams();
  const { getChildPageIds, getPageById } = usePageStore(storeType);
  const { t } = useTranslation();
  const [term, setTerm] = useState("");

  const slug = workspaceSlug?.toString();
  const query = term.trim();
  const searchesSubtree = scope === "page";

  const { data, isLoading, error } = useSWR(
    slug && query && !searchesSubtree ? ["PAGE_QUERY_SEARCH", slug, scope, query] : null,
    slug && query && !searchesSubtree
      ? () => pageQueryService.query(slug, { kind: "search", scope, project_id: page.project_ids?.[0], search: query })
      : null
  );

  const rootId = rootPageId ?? page.id;
  const subtreeMatches = useMemo(() => {
    if (!searchesSubtree || !query || !rootId) return [];
    const matches: string[] = [];
    const seen = new Set([rootId]);
    let frontier = [rootId];
    // Breadth-first rather than recursive so a parent cycle cannot run away.
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const parentId of frontier) {
        for (const childId of getChildPageIds(parentId)) {
          if (seen.has(childId)) continue;
          seen.add(childId);
          next.push(childId);
          const name = getPageById(childId)?.name ?? "";
          if (name.toLowerCase().includes(query.toLowerCase())) matches.push(childId);
        }
      }
      frontier = next;
    }
    return matches;
  }, [getChildPageIds, getPageById, query, rootId, searchesSubtree]);

  const input = (
    <input
      aria-label={placeholder ?? t("page_query_block.search_placeholder")}
      className="w-full rounded-sm bg-transparent px-2 py-1.5 text-13 outline-none placeholder:text-tertiary"
      placeholder={placeholder ?? t("page_query_block.search_placeholder")}
      value={term}
      onChange={(event) => setTerm(event.target.value)}
    />
  );

  let results: React.ReactNode = null;
  if (query && searchesSubtree) {
    results =
      subtreeMatches.length > 0 ? (
        <div className="space-y-0.5">
          {subtreeMatches.map((pageId) => (
            <SubPageItem key={pageId} pageId={pageId} storeType={storeType} />
          ))}
        </div>
      ) : (
        <Empty message={t("page_query_block.empty_state.search")} />
      );
  } else if (query) {
    if (isLoading) results = <Empty message={t("page_query_block.loading")} />;
    else if (error) results = <Empty message={t("page_query_block.error")} />;
    else if (!data || data.length === 0) results = <Empty message={t("page_query_block.empty_state.search")} />;
    else
      results = (
        <div className="space-y-0.5">
          {data.map((result) => (
            <QueryResultItem key={result.id} result={result} workspaceSlug={slug ?? ""} />
          ))}
        </div>
      );
  }

  return (
    <Shell>
      {input}
      {results}
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
    case "by-label":
      return <EndpointQuery {...props} />;
    case "label-list":
      return <LabelListQuery {...props} />;
    case "page-properties":
      return <PagePropertiesQuery {...props} />;
    case "contributors":
      return <ContributorsQuery {...props} />;
    case "search":
      return <SearchQuery {...props} />;
    default:
      // Kinds land one PR at a time, and an unrecognised one must still say
      // that something was here rather than render an empty box.
      return <Empty message={t("page_query_block.unsupported")} />;
  }
});
