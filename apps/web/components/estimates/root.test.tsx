// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { EUserPermissions } from "@plane/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceEstimatesQuery } from "@/hooks/queries/use-estimate-queries";
import { WEB_SWR_CONFIG } from "@/lib/swr-config";
import { EstimateRoot } from "./root";

const estimates = vi.hoisted(() => ({
  getProjectEstimates: vi.fn(),
  getWorkspaceEstimates: vi.fn(),
  currentActiveEstimateId: undefined,
  archivedEstimateIds: [],
}));

vi.mock("@/hooks/store/estimates", () => ({ useProjectEstimates: () => estimates }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ currentProjectDetails: undefined }) }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({
    workspaceProjectsPermissions: { ws: { p1: EUserPermissions.ADMIN } },
    getProjectRoleByWorkspaceSlugAndProjectId: () => EUserPermissions.ADMIN,
  }),
}));
vi.mock("@/components/settings/heading", () => ({ SettingsHeading: () => null }));
vi.mock("@plane/blocks/empty-state", () => ({ EmptyStateCompact: () => <div data-testid="empty" /> }));
vi.mock("./loader-screen", () => ({ EstimateLoaderScreen: () => <div data-testid="skeleton" /> }));
vi.mock("./create/modal", () => ({ CreateEstimateModal: () => null }));
vi.mock("./delete/modal", () => ({ DeleteEstimateModal: () => null }));

class StatusError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  );
}

function WorkspaceEstimates() {
  useWorkspaceEstimatesQuery("ws");
  return null;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("EstimateRoot", () => {
  it("shows the empty state when the workspace has no estimates", async () => {
    estimates.getWorkspaceEstimates.mockResolvedValueOnce([]);
    estimates.getProjectEstimates.mockReturnValueOnce(new Promise(() => {}));
    render(
      <Wrapper>
        <WorkspaceEstimates />
        <EstimateRoot workspaceSlug="ws" projectId="p1" isAdmin />
      </Wrapper>
    );

    await waitFor(() => expect(screen.getByTestId("empty")).toBeTruthy());
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });

  it("shows the empty state once the project has answered with no estimates", async () => {
    estimates.getProjectEstimates.mockResolvedValueOnce([]);
    render(<EstimateRoot workspaceSlug="ws" projectId="p1" isAdmin />, { wrapper: Wrapper });

    expect(screen.getByTestId("skeleton")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("empty")).toBeTruthy());
  });

  it("shows a retry when the estimates fail to load", async () => {
    estimates.getProjectEstimates.mockRejectedValueOnce(new StatusError(403));
    render(<EstimateRoot workspaceSlug="ws" projectId="p1" isAdmin />, { wrapper: Wrapper });

    const retry = await screen.findByRole("button");
    estimates.getProjectEstimates.mockResolvedValueOnce([]);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId("empty")).toBeTruthy());
    expect(estimates.getProjectEstimates).toHaveBeenCalledTimes(2);
  });
});
