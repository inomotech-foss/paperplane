// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback } from "react";
import useSWR from "swr";
import type { EUserPermissions } from "@plane/types";
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
  /** Fetches again, for a retry button. */
  retry: () => void;
  /** Fetches once if the query has no answer yet. Lazy queries load through this. */
  ensureLoaded: () => Promise<void>;
};

export type TStoreQueryOptions = {
  /** Wait for `ensureLoaded` instead of fetching on mount. For controls rendered once per row. */
  lazy?: boolean;
};

const SWR_OPTIONS = { revalidateIfStale: false, revalidateOnFocus: false };
const LAZY_SWR_OPTIONS = { ...SWR_OPTIONS, revalidateOnMount: false };

export const useStoreQuery = <T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  options: TStoreQueryOptions = {}
): TStoreQueryState => {
  const { data, error, isLoading, mutate } = useSWR<T, unknown>(
    key,
    fetcher,
    options.lazy ? LAZY_SWR_OPTIONS : SWR_OPTIONS
  );
  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);
  const ensureLoaded = useCallback(async () => {
    if (data === undefined) await mutate();
  }, [data, mutate]);
  return { isLoading, error: data === undefined ? error : undefined, retry, ensureLoaded };
};

type TProjectRoleKey = (projectId: string, projectRole: EUserPermissions | undefined) => string;

/**
 * A project list keyed on the user's project role, so it is fetched again when the role changes. The key stays
 * empty until the role is known, which fetches the list once on a cold load.
 */
export const useProjectStoreQuery = <T>(
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  roleKey: TProjectRoleKey,
  fetcher: (workspaceSlug: string, projectId: string) => Promise<T>,
  options: TStoreQueryOptions = {}
): TStoreQueryState => {
  const { getProjectRoleByWorkspaceSlugAndProjectId, workspaceProjectsPermissions } = useUserPermissions();
  const role =
    workspaceSlug && projectId ? getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId) : undefined;
  const key = workspaceSlug && projectId && role !== undefined ? roleKey(projectId, role) : null;
  // Without project roles for the workspace there is no key yet. Once they are in, a missing role means no access.
  const isWaitingForRole = !!workspaceSlug && !!projectId && !key && !workspaceProjectsPermissions[workspaceSlug];
  const state = useStoreQuery(
    key,
    workspaceSlug && projectId ? () => fetcher(workspaceSlug, projectId) : null,
    options
  );
  return { ...state, isLoading: state.isLoading || (isWaitingForRole && !options.lazy) };
};
