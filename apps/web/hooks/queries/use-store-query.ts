// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { EUserPermissions } from "@plane/types";
import { isRecord } from "@plane/types";
import { useUserPermissions } from "@/hooks/store/user";

/**
 * Request state of a query whose result lives in a MobX store. Components read entities from the store
 * and only ask this whether the query is still loading or failed.
 */
export type TStoreQueryState = {
  /** The query has no answer yet. */
  isLoading: boolean;
  /** The query failed and has no earlier answer to fall back on. Cleared by the next successful fetch. */
  error: unknown;
  /** Fetches again, for a retry button or after a change elsewhere. */
  retry: () => void;
  /** Fetches once if the query has no answer yet. Lazy queries load through this. */
  ensureLoaded: () => Promise<void>;
};

/** A wider query whose answer can contain this one, such as all workspace labels for one project's labels. */
export type TCoveringQuery = {
  key: string;
  /** Whether a given answer of the wider query contains this query's answer. */
  covers: (answer: unknown) => boolean;
};

export type TStoreQueryOptions = {
  /** Wait for `ensureLoaded` instead of fetching on mount. For controls rendered once per row. */
  lazy?: boolean;
  /**
   * Fetch again on every mount and show the cached answer meanwhile. For data other people change often.
   * Without it a key is fetched once per session, and again only through `retry`.
   */
  refreshOnMount?: boolean;
  coveredBy?: TCoveringQuery | null;
};

type TInternalOptions = TStoreQueryOptions & {
  /** The key is not known yet. Counts as loading unless the covering query answered. */
  isWaiting?: boolean;
};

/** Covers a project query when the wider answer holds at least one item of that project. */
export const coversProject =
  (projectId: string, field: string) =>
  (answer: unknown): boolean =>
    Array.isArray(answer) && answer.some((item) => isRecord(item) && item[field] === projectId);

export const useStoreQuery = <T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  options: TInternalOptions = {}
): TStoreQueryState => {
  const { cache, mutate: mutateKey } = useSWRConfig();
  const isCached = key !== null && cache.get(key)?.data !== undefined;
  const { data, error, isLoading, mutate } = useSWR<T, unknown>(key, options.lazy ? null : fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: !!options.refreshOnMount,
    // The app config revalidates on every mount. Here a cached key is only fetched again on request.
    revalidateOnMount: !options.lazy && (!!options.refreshOnMount || !isCached),
  });
  // Reads the covering query from the cache. Without a fetcher this never requests anything.
  const { data: covering } = useSWR<unknown, unknown>(options.coveredBy?.key ?? null, null);
  const isCovered = covering !== undefined && !!options.coveredBy?.covers(covering);
  const hasAnswer = data !== undefined || isCovered;

  const load = useCallback(async () => {
    if (!key || !fetcher) return;
    if (!options.lazy) {
      await mutate();
      return;
    }
    // A lazy query has no fetcher on the hook, so it would not fetch when its key changes.
    await mutateKey(key, fetcher()).catch(() => undefined);
  }, [key, fetcher, options.lazy, mutate, mutateKey]);

  const retry = useCallback(() => {
    void load();
  }, [load]);
  const ensureLoaded = useCallback(async () => {
    if (!hasAnswer) await load();
  }, [hasAnswer, load]);

  return {
    isLoading: !hasAnswer && (isLoading || (!!options.isWaiting && !options.lazy)),
    error: hasAnswer ? undefined : error,
    retry,
    ensureLoaded,
  };
};

type TProjectRoleKey = (projectId: string, projectRole: EUserPermissions | undefined) => string;

/**
 * A project list keyed on the user's project role, so it is fetched again when the role changes. A query that
 * fetches on mount waits for the workspace's project roles, so a cold load fetches the list once. A project
 * without a role, and a lazy query asked before the roles are in, use the key without a role.
 */
export const useProjectStoreQuery = <T>(
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  roleKey: TProjectRoleKey,
  fetcher: (workspaceSlug: string, projectId: string) => Promise<T>,
  options: TStoreQueryOptions = {}
): TStoreQueryState => {
  const { getProjectRoleByWorkspaceSlugAndProjectId, workspaceProjectsPermissions } = useUserPermissions();
  const hasProject = !!workspaceSlug && !!projectId;
  const rolesLoaded = !!workspaceSlug && !!workspaceProjectsPermissions[workspaceSlug];
  const role = hasProject ? getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId) : undefined;
  const canKey = hasProject && (role !== undefined || rolesLoaded || !!options.lazy);
  const key = canKey ? roleKey(projectId, role) : null;
  const fetchProject = useCallback(
    () => (workspaceSlug && projectId ? fetcher(workspaceSlug, projectId) : Promise.reject(new Error("No project"))),
    [workspaceSlug, projectId, fetcher]
  );
  return useStoreQuery(key, hasProject ? fetchProject : null, { ...options, isWaiting: hasProject && !key });
};
