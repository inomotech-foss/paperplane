// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, render, waitFor } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_SWR_CONFIG } from "@/lib/swr-config";
import { ProjectAuthWrapper } from "./project-wrapper";

const WORKSPACE = "ws";
const PROJECT = "project-1";

const project = observable({ id: PROJECT, issue_view: true, inbox_view: false });

const fetchProjectDetails = vi.fn(() => Promise.resolve(project));
const fetchUserProjectInfo = vi.fn(() => Promise.resolve({}));
const fetchProjectIntakeState = vi.fn(() => Promise.resolve({ id: "triage" }));
const resolved = () => Promise.resolve([]);
const fetchProjectUserProperties = vi.fn(() => Promise.resolve({}));
const userProperties: { current: { sort_order: number } | null } = { current: null };

vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ fetchProjectDetails, getProjectById: () => project }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "user-1" } }),
  useUserPermissions: () => ({
    fetchUserProjectInfo,
    allowPermissions: () => true,
    getProjectRoleByWorkspaceSlugAndProjectId: () => 15,
    joinProject: resolved,
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ fetchProjectStates: resolved, fetchProjectIntakeState }),
}));
vi.mock("@/hooks/store/estimates", () => ({ useProjectEstimates: () => ({ getProjectEstimates: resolved }) }));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({ fetchAllCycles: resolved }) }));
vi.mock("@/hooks/store/use-issue-custom-properties", () => ({
  useIssueCustomProperties: () => ({ fetchProjectProperties: resolved, fetchBulkValues: resolved }),
}));
vi.mock("@/hooks/store/use-issue-types", () => ({ useIssueTypes: () => ({ fetchProjectIssueTypes: resolved }) }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => ({ fetchProjectLabels: resolved }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    project: {
      fetchProjectMembers: resolved,
      fetchProjectUserProperties,
      getProjectUserProperties: () => userProperties.current,
    },
  }),
}));
vi.mock("@/hooks/store/use-module", () => ({
  useModule: () => ({ fetchModulesSlim: resolved, fetchModules: resolved }),
}));
vi.mock("@/hooks/store/use-project-view", () => ({ useProjectView: () => ({ fetchViews: resolved }) }));
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
});
