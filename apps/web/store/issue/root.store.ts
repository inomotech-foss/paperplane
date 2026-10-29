/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isEmpty } from "lodash-es";
import { autorun, makeObservable, observable, runInAction } from "mobx";
// types
import type { ICycle, IIssueLabel, IModule, IProject, IState, IUserLite, TIssueServiceType } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// plane web store
import type { IIssueDetail } from "@/store/issue/issue-details/root.store";
import { IssueDetail } from "@/store/issue/issue-details/root.store";
import type { RootStore } from "@/store/root.store";
import type { IWorkspaceMembership } from "@/store/member/workspace/workspace-member.store";
// issues data store
import type { IArchivedIssuesFilter, IArchivedIssues } from "./archived";
import { ArchivedIssuesFilter } from "./archived/filter.store";
import { ArchivedIssues } from "./archived/issue.store";
import type { ICycleIssuesFilter, ICycleIssues } from "./cycle";
import { CycleIssuesFilter } from "./cycle/filter.store";
import { CycleIssues } from "./cycle/issue.store";
import type { IIssueStore } from "./issue.store";
import { IssueStore } from "./issue.store";
import type { ICalendarStore } from "./issue_calendar_view.store";
import { CalendarStore } from "./issue_calendar_view.store";
import type { IIssueKanBanViewStore } from "./issue_kanban_view.store";
import { IssueKanBanViewStore } from "./issue_kanban_view.store";
import type { IModuleIssuesFilter, IModuleIssues } from "./module";
import { ModuleIssuesFilter } from "./module/filter.store";
import { ModuleIssues } from "./module/issue.store";
import type { IProfileIssuesFilter, IProfileIssues } from "./profile";
import { ProfileIssuesFilter } from "./profile/filter.store";
import { ProfileIssues } from "./profile/issue.store";
import type { IProjectIssuesFilter, IProjectIssues } from "./project";
import { ProjectIssuesFilter } from "./project/filter.store";
import { ProjectIssues } from "./project/issue.store";
import type { IProjectViewIssuesFilter, IProjectViewIssues } from "./project-views";
import { ProjectViewIssuesFilter } from "./project-views/filter.store";
import { ProjectViewIssues } from "./project-views/issue.store";
import type { IWorkspaceIssuesFilter } from "./workspace";
import { WorkspaceIssuesFilter } from "./workspace/filter.store";
import type { IWorkspaceIssues } from "./workspace/issue.store";
import { WorkspaceIssues } from "./workspace/issue.store";
import type { IWorkspaceDraftIssues, IWorkspaceDraftIssuesFilter } from "./workspace-draft";
import { WorkspaceDraftIssues } from "./workspace-draft/issue.store";
import { WorkspaceDraftIssuesFilter } from "./workspace-draft/filter.store";

export interface IIssueRootStore {
  currentUserId: string | undefined;
  workspaceSlug: string | undefined;
  teamspaceId: string | undefined;
  projectId: string | undefined;
  cycleId: string | undefined;
  moduleId: string | undefined;
  viewId: string | undefined;
  globalViewId: string | undefined; // all issues view id
  userId: string | undefined; // user profile detail Id
  stateMap: Record<string, IState> | undefined;
  stateDetails: IState[] | undefined;
  workspaceStateDetails: IState[] | undefined;
  labelMap: Record<string, IIssueLabel> | undefined;
  workSpaceMemberRolesMap: Record<string, IWorkspaceMembership> | undefined;
  memberMap: Record<string, IUserLite> | undefined;
  projectMap: Record<string, IProject> | undefined;
  moduleMap: Record<string, IModule> | undefined;
  cycleMap: Record<string, ICycle> | undefined;

  rootStore: RootStore;
  serviceType: TIssueServiceType;

  issues: IIssueStore;

  issueDetail: IIssueDetail;

  workspaceIssuesFilter: IWorkspaceIssuesFilter;
  workspaceIssues: IWorkspaceIssues;

  workspaceDraftIssuesFilter: IWorkspaceDraftIssuesFilter;
  workspaceDraftIssues: IWorkspaceDraftIssues;

  profileIssuesFilter: IProfileIssuesFilter;
  profileIssues: IProfileIssues;

  teamIssuesFilter: IProjectIssuesFilter;
  teamIssues: IProjectIssues;

  projectIssuesFilter: IProjectIssuesFilter;
  projectIssues: IProjectIssues;

  cycleIssuesFilter: ICycleIssuesFilter;
  cycleIssues: ICycleIssues;

  moduleIssuesFilter: IModuleIssuesFilter;
  moduleIssues: IModuleIssues;

  teamViewIssuesFilter: IProjectViewIssuesFilter;
  teamViewIssues: IProjectViewIssues;

  teamProjectWorkItemsFilter: IProjectIssuesFilter;
  teamProjectWorkItems: IProjectIssues;

  projectViewIssuesFilter: IProjectViewIssuesFilter;
  projectViewIssues: IProjectViewIssues;

  archivedIssuesFilter: IArchivedIssuesFilter;
  archivedIssues: IArchivedIssues;

  issueKanBanView: IIssueKanBanViewStore;
  issueCalendarView: ICalendarStore;
}

const nonEmpty = <T>(value: T | undefined): T | undefined => (isEmpty(value) ? undefined : value);

export class IssueRootStore implements IIssueRootStore {
  currentUserId: string | undefined = undefined;
  workspaceSlug: string | undefined = undefined;
  teamspaceId: string | undefined = undefined;
  projectId: string | undefined = undefined;
  cycleId: string | undefined = undefined;
  moduleId: string | undefined = undefined;
  viewId: string | undefined = undefined;
  globalViewId: string | undefined = undefined;
  userId: string | undefined = undefined;
  stateMap: Record<string, IState> | undefined = undefined;
  stateDetails: IState[] | undefined = undefined;
  workspaceStateDetails: IState[] | undefined = undefined;
  labelMap: Record<string, IIssueLabel> | undefined = undefined;
  workSpaceMemberRolesMap: Record<string, IWorkspaceMembership> | undefined = undefined;
  memberMap: Record<string, IUserLite> | undefined = undefined;
  projectMap: Record<string, IProject> | undefined = undefined;
  moduleMap: Record<string, IModule> | undefined = undefined;
  cycleMap: Record<string, ICycle> | undefined = undefined;

  rootStore: RootStore;
  serviceType: TIssueServiceType;

  issues: IIssueStore;

  issueDetail: IIssueDetail;

  workspaceIssuesFilter: IWorkspaceIssuesFilter;
  workspaceIssues: IWorkspaceIssues;

  workspaceDraftIssuesFilter: IWorkspaceDraftIssuesFilter;
  workspaceDraftIssues: IWorkspaceDraftIssues;

  profileIssuesFilter: IProfileIssuesFilter;
  profileIssues: IProfileIssues;

  teamIssuesFilter: IProjectIssuesFilter;
  teamIssues: IProjectIssues;

  projectIssuesFilter: IProjectIssuesFilter;
  projectIssues: IProjectIssues;

  cycleIssuesFilter: ICycleIssuesFilter;
  cycleIssues: ICycleIssues;

  moduleIssuesFilter: IModuleIssuesFilter;
  moduleIssues: IModuleIssues;

  teamViewIssuesFilter: IProjectViewIssuesFilter;
  teamViewIssues: IProjectViewIssues;

  projectViewIssuesFilter: IProjectViewIssuesFilter;
  projectViewIssues: IProjectViewIssues;

  teamProjectWorkItemsFilter: IProjectIssuesFilter;
  teamProjectWorkItems: IProjectIssues;

  archivedIssuesFilter: IArchivedIssuesFilter;
  archivedIssues: IArchivedIssues;

  issueKanBanView: IIssueKanBanViewStore;
  issueCalendarView: ICalendarStore;

  constructor(rootStore: RootStore, serviceType: TIssueServiceType = EIssueServiceType.ISSUES) {
    makeObservable(this, {
      workspaceSlug: observable.ref,
      teamspaceId: observable.ref,
      projectId: observable.ref,
      cycleId: observable.ref,
      moduleId: observable.ref,
      viewId: observable.ref,
      userId: observable.ref,
      globalViewId: observable.ref,
      stateMap: observable,
      stateDetails: observable,
      workspaceStateDetails: observable,
      labelMap: observable,
      memberMap: observable,
      workSpaceMemberRolesMap: observable,
      projectMap: observable,
      moduleMap: observable,
      cycleMap: observable,
    });

    this.serviceType = serviceType;
    this.rootStore = rootStore;

    autorun(() => {
      const { router, state, label, memberRoot, projectRoot, cycle } = rootStore;
      const currentUserId = rootStore.user?.data?.id;
      const { workspaceSlug, teamspaceId, projectId, cycleId, moduleId, viewId, globalViewId, userId } = router;
      const stateMap = nonEmpty(state?.stateMap);
      const projectStates = nonEmpty(state?.projectStates);
      const workspaceStates = nonEmpty(state?.workspaceStates);
      const labelMap = nonEmpty(label?.labelMap);
      const hasWorkspaceMembers = !isEmpty(memberRoot?.workspace?.workspaceMemberMap);
      const workspaceMemberRoles = memberRoot?.workspace?.memberMap;
      const memberMap = nonEmpty(memberRoot?.memberMap);
      const projectMap = nonEmpty(projectRoot?.project?.projectMap);
      const moduleMap = nonEmpty(rootStore.module?.moduleMap);
      const cycleMap = nonEmpty(cycle?.cycleMap);
      runInAction(() => {
        if (currentUserId) this.currentUserId = currentUserId;
        this.workspaceSlug = workspaceSlug;
        this.teamspaceId = teamspaceId;
        this.projectId = projectId;
        this.cycleId = cycleId;
        this.moduleId = moduleId;
        this.viewId = viewId;
        this.globalViewId = globalViewId;
        this.userId = userId;
        if (stateMap) this.stateMap = stateMap;
        if (projectStates) this.stateDetails = projectStates;
        if (workspaceStates) this.workspaceStateDetails = workspaceStates;
        if (labelMap) this.labelMap = labelMap;
        if (hasWorkspaceMembers) this.workSpaceMemberRolesMap = workspaceMemberRoles || undefined;
        if (memberMap) this.memberMap = memberMap;
        if (projectMap) this.projectMap = projectMap;
        if (moduleMap) this.moduleMap = moduleMap;
        if (cycleMap) this.cycleMap = cycleMap;
      });
    });

    this.issues = new IssueStore();

    this.issueDetail = new IssueDetail(this, EIssueServiceType.ISSUES);

    this.workspaceIssuesFilter = new WorkspaceIssuesFilter(this);
    this.workspaceIssues = new WorkspaceIssues(this, this.workspaceIssuesFilter);

    this.profileIssuesFilter = new ProfileIssuesFilter(this);
    this.profileIssues = new ProfileIssues(this, this.profileIssuesFilter);

    this.workspaceDraftIssuesFilter = new WorkspaceDraftIssuesFilter(this);
    this.workspaceDraftIssues = new WorkspaceDraftIssues(this);

    this.projectIssuesFilter = new ProjectIssuesFilter(this);
    this.projectIssues = new ProjectIssues(this, this.projectIssuesFilter);

    this.teamIssuesFilter = new ProjectIssuesFilter(this);
    this.teamIssues = new ProjectIssues(this, this.teamIssuesFilter);

    this.cycleIssuesFilter = new CycleIssuesFilter(this);
    this.cycleIssues = new CycleIssues(this, this.cycleIssuesFilter);

    this.moduleIssuesFilter = new ModuleIssuesFilter(this);
    this.moduleIssues = new ModuleIssues(this, this.moduleIssuesFilter);

    this.teamViewIssuesFilter = new ProjectViewIssuesFilter(this);
    this.teamViewIssues = new ProjectViewIssues(this, this.teamViewIssuesFilter);

    this.projectViewIssuesFilter = new ProjectViewIssuesFilter(this);
    this.projectViewIssues = new ProjectViewIssues(this, this.projectViewIssuesFilter);

    this.teamProjectWorkItemsFilter = new ProjectIssuesFilter(this);
    this.teamProjectWorkItems = new ProjectIssues(this, this.teamProjectWorkItemsFilter);

    this.archivedIssuesFilter = new ArchivedIssuesFilter(this);
    this.archivedIssues = new ArchivedIssues(this, this.archivedIssuesFilter);

    this.issueKanBanView = new IssueKanBanViewStore(this);
    this.issueCalendarView = new CalendarStore(this);
  }
}
