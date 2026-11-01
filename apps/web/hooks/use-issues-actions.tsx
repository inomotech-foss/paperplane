/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useMemo } from "react";
// types
import { useParams } from "next/navigation";
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import { EDraftIssuePaginationType } from "@plane/constants";
import type {
  IssuePaginationOptions,
  TIssue,
  TIssuesResponse,
  TLoader,
  TProfileViews,
  TSupportedFilterForUpdate,
  TWorkspaceDraftIssue,
  TWorkspaceDraftPaginationInfo,
} from "@plane/types";
import { EIssuesStoreType, isOneOf } from "@plane/types";
import { useIssues } from "./store/use-issues";

const PROFILE_VIEWS: readonly TProfileViews[] = ["assigned", "created", "subscribed"];

// Workspace drafts page through their own response shape.
type TFetchedIssues = TIssuesResponse | TWorkspaceDraftPaginationInfo<TWorkspaceDraftIssue>;

export interface IssueActions {
  fetchIssues: (
    loadType: TLoader,
    options: IssuePaginationOptions,
    viewId?: string
  ) => Promise<TFetchedIssues | undefined>;
  fetchNextIssues: (groupId?: string, subGroupId?: string) => Promise<TFetchedIssues | undefined>;
  removeIssue: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  createIssue?: (
    projectId: string | undefined | null,
    data: Partial<TIssue>
  ) => Promise<TIssue | TWorkspaceDraftIssue | undefined>;
  quickAddIssue?: (projectId: string | undefined | null, data: TIssue) => Promise<TIssue | undefined>;
  updateIssue?: (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => Promise<void>;
  removeIssueFromView?: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  archiveIssue?: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  restoreIssue?: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  updateFilters: (
    projectId: string,
    filterType: TSupportedFilterTypeForUpdate,
    filters: TSupportedFilterForUpdate
  ) => Promise<void>;
}

export const useIssuesActions = (storeType: EIssuesStoreType): IssueActions => {
  const projectIssueActions = useProjectIssueActions();
  const cycleIssueActions = useCycleIssueActions();
  const moduleIssueActions = useModuleIssueActions();
  const projectViewIssueActions = useProjectViewIssueActions();
  const globalIssueActions = useGlobalIssueActions();
  const profileIssueActions = useProfileIssueActions();
  const archivedIssueActions = useArchivedIssueActions();
  const workspaceDraftIssueActions = useWorkspaceDraftIssueActions();

  switch (storeType) {
    case EIssuesStoreType.PROJECT_VIEW:
      return projectViewIssueActions;
    case EIssuesStoreType.PROFILE:
      return profileIssueActions;
    case EIssuesStoreType.ARCHIVED:
      return archivedIssueActions;
    case EIssuesStoreType.CYCLE:
      return cycleIssueActions;
    case EIssuesStoreType.MODULE:
      return moduleIssueActions;
    case EIssuesStoreType.GLOBAL:
      return globalIssueActions;
    case EIssuesStoreType.WORKSPACE_DRAFT:
      return workspaceDraftIssueActions;
    case EIssuesStoreType.PROJECT:
    default:
      return projectIssueActions;
  }
};

const useProjectIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT);

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions) => {
      if (!workspaceSlug || !projectId) return;
      return issues.fetchIssues(workspaceSlug.toString(), projectId.toString(), loadType, options);
    },
    [issues.fetchIssues, workspaceSlug, projectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !projectId) return;
      return issues.fetchNextIssues(workspaceSlug.toString(), projectId.toString(), groupId, subGroupId);
    },
    [issues.fetchNextIssues, workspaceSlug, projectId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.createIssue(workspaceSlug, projectId, data);
    },
    [issues.createIssue, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.quickAddIssue(workspaceSlug, projectId, data);
    },
    [issues.quickAddIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.updateIssue(workspaceSlug, projectId, issueId, data);
    },
    [issues.updateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(workspaceSlug, projectId, issueId);
    },
    [issues.removeIssue, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.archiveIssue(workspaceSlug, projectId, issueId);
    },
    [issues.archiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, projectId, filterType, filters);
    },
    [issuesFilter.updateFilters, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      archiveIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, quickAddIssue, updateIssue, removeIssue, archiveIssue, updateFilters]
  );
};

const useCycleIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, cycleId: routerCycleId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  const cycleId = routerCycleId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.CYCLE);

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, cycleId?: string) => {
      if (!workspaceSlug || !projectId || !cycleId) return;
      return issues.fetchIssues(workspaceSlug.toString(), projectId.toString(), loadType, options, cycleId.toString());
    },
    [issues.fetchIssues, workspaceSlug, projectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !projectId || !cycleId) return;
      return issues.fetchNextIssues(
        workspaceSlug.toString(),
        projectId.toString(),
        cycleId.toString(),
        groupId,
        subGroupId
      );
    },
    [issues.fetchNextIssues, workspaceSlug, projectId, cycleId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!cycleId || !workspaceSlug || !projectId) return;
      return await issues.createIssue(workspaceSlug, projectId, data, cycleId);
    },
    [issues.createIssue, cycleId, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!cycleId || !workspaceSlug || !projectId) return;
      return await issues.quickAddIssue(workspaceSlug, projectId, data, cycleId);
    },
    [issues.quickAddIssue, workspaceSlug, cycleId]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.updateIssue(workspaceSlug, projectId, issueId, data);
    },
    [issues.updateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(workspaceSlug, projectId, issueId);
    },
    [issues.removeIssue, workspaceSlug]
  );
  const removeIssueFromView = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!cycleId || !workspaceSlug || !projectId) return;
      return await issues.removeIssueFromCycle(workspaceSlug, projectId, cycleId, issueId);
    },
    [issues.removeIssueFromCycle, cycleId, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.archiveIssue(workspaceSlug, projectId, issueId);
    },
    [issues.archiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!cycleId || !workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, projectId, filterType, filters, cycleId);
    },
    [issuesFilter.updateFilters, cycleId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    }),
    [
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    ]
  );
};

const useModuleIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, moduleId: routerModuleId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  const moduleId = routerModuleId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.MODULE);

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, moduleId?: string) => {
      if (!workspaceSlug || !projectId || !moduleId) return;
      return issues.fetchIssues(workspaceSlug.toString(), projectId.toString(), loadType, options, moduleId.toString());
    },
    [issues.fetchIssues, workspaceSlug, projectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !projectId || !moduleId) return;
      return issues.fetchNextIssues(
        workspaceSlug.toString(),
        projectId.toString(),
        moduleId.toString(),
        groupId,
        subGroupId
      );
    },
    [issues.fetchNextIssues, workspaceSlug, projectId, moduleId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!moduleId || !workspaceSlug || !projectId) return;
      return await issues.createIssue(workspaceSlug, projectId, data, moduleId);
    },
    [issues.createIssue, moduleId, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!moduleId || !workspaceSlug || !projectId) return;
      return await issues.quickAddIssue(workspaceSlug, projectId, data, moduleId);
    },
    [issues.quickAddIssue, workspaceSlug, moduleId]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.updateIssue(workspaceSlug, projectId, issueId, data);
    },
    [issues.updateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(workspaceSlug, projectId, issueId);
    },
    [issues.removeIssue, workspaceSlug]
  );
  const removeIssueFromView = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!moduleId || !workspaceSlug || !projectId) return;
      return await issues.removeIssuesFromModule(workspaceSlug, projectId, moduleId, [issueId]);
    },
    [issues.removeIssuesFromModule, moduleId, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.archiveIssue(workspaceSlug, projectId, issueId);
    },
    [issues.archiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!moduleId || !workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, projectId, filterType, filters, moduleId);
    },
    [issuesFilter.updateFilters, moduleId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    }),
    [
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    ]
  );
};

const useProfileIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, userId: routerUserId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const userId = routerUserId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROFILE);

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, viewId?: string) => {
      if (!workspaceSlug || !userId || !isOneOf(PROFILE_VIEWS, viewId)) return;
      return issues.fetchIssues(workspaceSlug.toString(), userId.toString(), loadType, options, viewId);
    },
    [issues.fetchIssues, workspaceSlug, userId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !userId) return;
      return issues.fetchNextIssues(workspaceSlug.toString(), userId.toString(), groupId, subGroupId);
    },
    [issues.fetchNextIssues, workspaceSlug, userId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.createIssue(workspaceSlug, projectId, data);
    },
    [issues.createIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.updateIssue(workspaceSlug, projectId, issueId, data);
    },
    [issues.updateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(workspaceSlug, projectId, issueId);
    },
    [issues.removeIssue, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.archiveIssue(workspaceSlug, projectId, issueId);
    },
    [issues.archiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!userId || !workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, projectId, filterType, filters, userId);
    },
    [issuesFilter.updateFilters, userId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      updateIssue,
      removeIssue,
      archiveIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, updateIssue, removeIssue, archiveIssue, updateFilters]
  );
};

const useProjectViewIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, viewId: routerViewId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  const viewId = routerViewId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT_VIEW);

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, viewId?: string) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      return issues.fetchIssues(workspaceSlug.toString(), projectId.toString(), viewId, loadType, options);
    },
    [issues.fetchIssues, workspaceSlug, projectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      return issues.fetchNextIssues(workspaceSlug.toString(), projectId.toString(), viewId, groupId, subGroupId);
    },
    [issues.fetchNextIssues, workspaceSlug, projectId, viewId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.createIssue(workspaceSlug, projectId, data);
    },
    [issues.createIssue, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.quickAddIssue(workspaceSlug, projectId, data);
    },
    [issues.quickAddIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.updateIssue(workspaceSlug, projectId, issueId, data);
    },
    [issues.updateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(workspaceSlug, projectId, issueId);
    },
    [issues.removeIssue, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.archiveIssue(workspaceSlug, projectId, issueId);
    },
    [issues.archiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!viewId || !workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, projectId, filterType, filters, viewId);
    },
    [issuesFilter.updateFilters, viewId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      archiveIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, quickAddIssue, updateIssue, removeIssue, archiveIssue, updateFilters]
  );
};

const useArchivedIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.ARCHIVED);

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions) => {
      if (!workspaceSlug || !projectId) return;
      return issues.fetchIssues(workspaceSlug.toString(), projectId.toString(), loadType, options);
    },
    [issues.fetchIssues, workspaceSlug, projectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !projectId) return;
      return issues.fetchNextIssues(workspaceSlug.toString(), projectId.toString(), groupId, subGroupId);
    },
    [issues.fetchNextIssues, workspaceSlug, projectId]
  );

  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(workspaceSlug, projectId, issueId);
    },
    [issues.removeIssue, workspaceSlug]
  );
  const restoreIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.restoreIssue(workspaceSlug, projectId, issueId);
    },
    [issues.restoreIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, projectId, filterType, filters);
    },
    [issuesFilter.updateFilters, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      removeIssue,
      restoreIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, removeIssue, restoreIssue, updateFilters]
  );
};

const useGlobalIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, globalViewId: routerGlobalViewId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const globalViewId = routerGlobalViewId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.GLOBAL);

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions) => {
      if (!workspaceSlug || !globalViewId) return;
      return issues.fetchIssues(workspaceSlug.toString(), globalViewId.toString(), loadType, options);
    },
    [issues.fetchIssues, workspaceSlug, globalViewId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !globalViewId) return;
      return issues.fetchNextIssues(workspaceSlug.toString(), globalViewId.toString(), groupId, subGroupId);
    },
    [issues.fetchNextIssues, workspaceSlug, globalViewId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.createIssue(workspaceSlug, projectId, data);
    },
    [issues.createIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.updateIssue(workspaceSlug, projectId, issueId, data);
    },
    [issues.updateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(workspaceSlug, projectId, issueId);
    },
    [issues.removeIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!globalViewId || !workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, projectId, filterType, filters, globalViewId);
    },
    [issuesFilter.updateFilters, globalViewId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      updateIssue,
      removeIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, updateIssue, removeIssue, updateFilters]
  );
};

const useWorkspaceDraftIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.WORKSPACE_DRAFT);
  const fetchIssues = useCallback(
    async (loadType: TLoader, _options: IssuePaginationOptions) => {
      if (!workspaceSlug) return;
      return issues.fetchIssues(workspaceSlug.toString(), loadType, EDraftIssuePaginationType.INIT);
    },
    [workspaceSlug, issues]
  );

  const fetchNextIssues = useCallback(async () => {
    if (!workspaceSlug) return;
    return issues.fetchIssues(workspaceSlug.toString(), "pagination", EDraftIssuePaginationType.NEXT);
  }, [workspaceSlug, issues]);

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.createIssue(workspaceSlug, data);
    },
    [issues, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      await issues.updateIssue(workspaceSlug, issueId, data);
    },
    [issues, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await issues.removeIssue(issueId);
    },
    [issues, workspaceSlug]
  );

  // const moveToIssue = useCallback(
  //   async (workspaceSlug: string, issueId: string, data: Partial<TIssue>) => {
  //     if (!workspaceSlug || !issueId || !data) return;
  //     return await issues.moveToIssues(workspaceSlug, issueId, data);
  //   },
  //   [issues]
  // );

  const updateFilters = useCallback(
    async (_projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!workspaceSlug) return;
      return await issuesFilter.updateFilters(workspaceSlug, filterType, filters);
    },
    [workspaceSlug, issuesFilter]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      updateIssue,
      removeIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, updateIssue, removeIssue, updateFilters]
  );
};
