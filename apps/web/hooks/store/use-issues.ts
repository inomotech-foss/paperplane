/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
import { merge } from "lodash-es";
import type { TIssueMap } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { StoreContext } from "@/lib/store-context";
import type { IArchivedIssues, IArchivedIssuesFilter } from "@/store/issue/archived";
import type { IWorkspaceIssues } from "@/store/issue/workspace/issue.store";
import type { ICycleIssues, ICycleIssuesFilter } from "@/store/issue/cycle";
import type { IModuleIssues, IModuleIssuesFilter } from "@/store/issue/module";
import type { IProfileIssues, IProfileIssuesFilter } from "@/store/issue/profile";
import type { IProjectIssues, IProjectIssuesFilter } from "@/store/issue/project";
import type { IProjectViewIssues, IProjectViewIssuesFilter } from "@/store/issue/project-views";
import type { IWorkspaceIssuesFilter } from "@/store/issue/workspace";
import type { IWorkspaceDraftIssues, IWorkspaceDraftIssuesFilter } from "@/store/issue/workspace-draft";
// constants

type defaultIssueStore = {
  issueMap: TIssueMap;
};

export type TStoreIssues = {
  [EIssuesStoreType.GLOBAL]: defaultIssueStore & {
    issues: IWorkspaceIssues;
    issuesFilter: IWorkspaceIssuesFilter;
  };
  [EIssuesStoreType.WORKSPACE_DRAFT]: defaultIssueStore & {
    issues: IWorkspaceDraftIssues;
    issuesFilter: IWorkspaceDraftIssuesFilter;
  };
  [EIssuesStoreType.PROFILE]: defaultIssueStore & {
    issues: IProfileIssues;
    issuesFilter: IProfileIssuesFilter;
  };
  [EIssuesStoreType.TEAM]: defaultIssueStore & {
    issues: IProjectIssues;
    issuesFilter: IProjectIssuesFilter;
  };
  [EIssuesStoreType.PROJECT]: defaultIssueStore & {
    issues: IProjectIssues;
    issuesFilter: IProjectIssuesFilter;
  };
  [EIssuesStoreType.CYCLE]: defaultIssueStore & {
    issues: ICycleIssues;
    issuesFilter: ICycleIssuesFilter;
  };
  [EIssuesStoreType.MODULE]: defaultIssueStore & {
    issues: IModuleIssues;
    issuesFilter: IModuleIssuesFilter;
  };
  [EIssuesStoreType.TEAM_VIEW]: defaultIssueStore & {
    issues: IProjectViewIssues;
    issuesFilter: IProjectViewIssuesFilter;
  };
  [EIssuesStoreType.PROJECT_VIEW]: defaultIssueStore & {
    issues: IProjectViewIssues;
    issuesFilter: IProjectViewIssuesFilter;
  };
  [EIssuesStoreType.ARCHIVED]: defaultIssueStore & {
    issues: IArchivedIssues;
    issuesFilter: IArchivedIssuesFilter;
  };
  [EIssuesStoreType.DEFAULT]: defaultIssueStore & {
    issues: IProjectIssues;
    issuesFilter: IProjectIssuesFilter;
  };
  [EIssuesStoreType.TEAM_PROJECT_WORK_ITEMS]: defaultIssueStore & {
    issues: IProjectIssues;
    issuesFilter: IProjectIssuesFilter;
  };
};

type TIssueStoreGetters = { [K in EIssuesStoreType]: () => TStoreIssues[K] };

const getIssueStore = <T extends EIssuesStoreType>(getters: TIssueStoreGetters, storeType: T): TStoreIssues[T] =>
  getters[storeType]();

export function useIssues(): TStoreIssues[EIssuesStoreType.DEFAULT];
export function useIssues<T extends EIssuesStoreType>(storeType: T): TStoreIssues[T];
export function useIssues<T extends EIssuesStoreType>(storeType?: T) {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useIssues must be used within StoreProvider");

  const { issue } = context;
  const withIssueMap = <S extends object>(stores: S) => merge({ issueMap: issue.issues.issuesMap }, stores);
  const projectStores = () => withIssueMap({ issues: issue.projectIssues, issuesFilter: issue.projectIssuesFilter });

  const getters: TIssueStoreGetters = {
    [EIssuesStoreType.GLOBAL]: () =>
      withIssueMap({ issues: issue.workspaceIssues, issuesFilter: issue.workspaceIssuesFilter }),
    [EIssuesStoreType.WORKSPACE_DRAFT]: () =>
      withIssueMap({ issues: issue.workspaceDraftIssues, issuesFilter: issue.workspaceDraftIssuesFilter }),
    [EIssuesStoreType.PROFILE]: () =>
      withIssueMap({ issues: issue.profileIssues, issuesFilter: issue.profileIssuesFilter }),
    [EIssuesStoreType.TEAM]: () => withIssueMap({ issues: issue.teamIssues, issuesFilter: issue.teamIssuesFilter }),
    [EIssuesStoreType.PROJECT]: projectStores,
    [EIssuesStoreType.CYCLE]: () => withIssueMap({ issues: issue.cycleIssues, issuesFilter: issue.cycleIssuesFilter }),
    [EIssuesStoreType.MODULE]: () =>
      withIssueMap({ issues: issue.moduleIssues, issuesFilter: issue.moduleIssuesFilter }),
    [EIssuesStoreType.TEAM_VIEW]: () =>
      withIssueMap({ issues: issue.teamViewIssues, issuesFilter: issue.teamViewIssuesFilter }),
    [EIssuesStoreType.PROJECT_VIEW]: () =>
      withIssueMap({ issues: issue.projectViewIssues, issuesFilter: issue.projectViewIssuesFilter }),
    [EIssuesStoreType.ARCHIVED]: () =>
      withIssueMap({ issues: issue.archivedIssues, issuesFilter: issue.archivedIssuesFilter }),
    [EIssuesStoreType.DEFAULT]: projectStores,
    [EIssuesStoreType.TEAM_PROJECT_WORK_ITEMS]: () =>
      withIssueMap({ issues: issue.teamProjectWorkItems, issuesFilter: issue.teamProjectWorkItemsFilter }),
  };

  return storeType === undefined ? getIssueStore(getters, EIssuesStoreType.DEFAULT) : getIssueStore(getters, storeType);
}
