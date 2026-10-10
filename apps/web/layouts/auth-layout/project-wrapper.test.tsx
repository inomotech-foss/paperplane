// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, render, waitFor } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { SWRConfig } from "swr";
import { EUserPermissions } from "@plane/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_SWR_CONFIG } from "@/lib/swr-config";
import { ProjectAuthWrapper } from "./project-wrapper";

const WORKSPACE = "ws";
const PROJECT = "project-1";

const project = observable({ id: PROJECT, issue_view: true, inbox_view: false });
const role = observable.box<EUserPermissions | undefined>(EUserPermissions.MEMBER);

const fetchProjectDetails = vi.fn(() => Promise.resolve(project));
const fetchUserProjectInfo = vi.fn(() => Promise.resolve({}));
const fetchProjectIntakeState = vi.fn(() => Promise.resolve({ id: "triage" }));
const resolved = () => Promise.resolve([]);
const fetchProjectUserProperties = vi.fn(() => Promise.resolve({}));
const userProperties: { current: { sort_order: number } | null } = { current: null };
const lists = {
  fetchProjectStates: vi.fn(resolved),
  getProjectEstimates: vi.fn(resolved),
  fetchAllCycles: vi.fn(resolved),
  fetchProjectProperties: vi.fn(resolved),
  fetchBulkValues: vi.fn(resolved),
  fetchProjectIssueTypes: vi.fn(resolved),
  fetchProjectLabels: vi.fn(resolved),
  fetchProjectMembers: vi.fn(resolved),
  fetchModulesSlim: vi.fn(resolved),
  fetchModules: vi.fn(resolved),
  fetchViews: vi.fn(resolved),
};

vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ fetchProjectDetails, getProjectById: () => project }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "user-1" } }),
  useUserPermissions: () => ({
    fetchUserProjectInfo,
    allowPermissions: () => true,
    getProjectRoleByWorkspaceSlugAndProjectId: () => role.get(),
    joinProject: resolved,
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ fetchProjectStates: lists.fetchProjectStates, fetchProjectIntakeState }),
}));
vi.mock("@/hooks/store/estimates", () => ({
  useProjectEstimates: () => ({ getProjectEstimates: lists.getProjectEstimates }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({ fetchAllCycles: lists.fetchAllCycles }) }));
vi.mock("@/hooks/store/use-issue-custom-properties", () => ({
  useIssueCustomProperties: () => ({
    fetchProjectProperties: lists.fetchProjectProperties,
    fetchBulkValues: lists.fetchBulkValues,
  }),
}));
vi.mock("@/hooks/store/use-issue-types", () => ({
  useIssueTypes: () => ({ fetchProjectIssueTypes: lists.fetchProjectIssueTypes }),
}));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => ({ fetchProjectLabels: lists.fetchProjectLabels }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    project: {
      fetchProjectMembers: lists.fetchProjectMembers,
      fetchProjectUserProperties,
      getProjectUserProperties: () => userProperties.current,
    },
  }),
}));
vi.mock("@/hooks/store/use-module", () => ({
  useModule: () => ({ fetchModulesSlim: lists.fetchModulesSlim, fetchModules: lists.fetchModules }),
}));
vi.mock("@/hooks/store/use-project-view", () => ({ useProjectView: () => ({ fetchViews: lists.fetchViews }) }));
vi.mock("@/hooks/use-timeline-chart", () => ({ useTimeLineChart: () => ({ initGantt: () => {} }) }));
vi.mock("@/components/auth-screens/project/project-access-restriction", () => ({
  ProjectAccessRestriction: () => null,
}));

const renderWrapper = () =>
  render(
    <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => new Map(), dedupingInterval: 0, focusThrottleInterval: 0 }}>
      <ProjectAuthWrapper workspaceSlug={WORKSPACE} projectId={PROJECT}>
        <span>content</span>
      </ProjectAuthWrapper>
    </SWRConfig>
  );

afterEach(() => {
  vi.clearAllMocks();
  userProperties.current = null;
  runInAction(() => {
    project.inbox_view = false;
    role.set(EUserPermissions.MEMBER);
  });
});

describe("ProjectAuthWrapper", () => {
  it("does not request the intake state when intake is disabled", async () => {
    renderWrapper();
    await waitFor(() => expect(fetchProjectDetails).toHaveBeenCalled());
    expect(fetchProjectIntakeState).not.toHaveBeenCalled();
  });

  it("requests the intake state once intake is turned on", async () => {
    renderWrapper();
    await waitFor(() => expect(fetchProjectDetails).toHaveBeenCalled());
    act(() => {
      runInAction(() => {
        project.inbox_view = true;
      });
    });
    await waitFor(() => expect(fetchProjectIntakeState).toHaveBeenCalledWith(WORKSPACE, PROJECT));
  });

  it("does not refetch project details or membership on window focus", async () => {
    renderWrapper();
    await waitFor(() => expect(fetchUserProjectInfo).toHaveBeenCalledTimes(1));
    expect(fetchProjectDetails).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchProjectDetails).toHaveBeenCalledTimes(1);
    expect(fetchUserProjectInfo).toHaveBeenCalledTimes(1);
  });

  it("fetches the project user properties once", async () => {
    renderWrapper();
    await waitFor(() => expect(fetchProjectUserProperties).toHaveBeenCalledOnce());
    expect(fetchProjectUserProperties).toHaveBeenCalledWith(WORKSPACE, PROJECT);
  });

  it("reuses the project user properties the work items route loaded", async () => {
    userProperties.current = { sort_order: 0 };
    renderWrapper();
    await waitFor(() => expect(fetchUserProjectInfo).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchProjectUserProperties).not.toHaveBeenCalled();
  });

  it("fetches each project list once when the role resolves after mount", async () => {
    runInAction(() => role.set(undefined));
    renderWrapper();
    await waitFor(() => expect(fetchUserProjectInfo).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    for (const fetcher of [...Object.values(lists), fetchProjectUserProperties]) expect(fetcher).not.toHaveBeenCalled();
    act(() => {
      runInAction(() => role.set(EUserPermissions.MEMBER));
    });
    await waitFor(() => expect(lists.fetchViews).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    for (const fetcher of [...Object.values(lists), fetchProjectUserProperties]) expect(fetcher).toHaveBeenCalledOnce();
  });
});
